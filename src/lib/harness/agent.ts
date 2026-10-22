import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, skills } from "@/db/schema";
import { getSettings, DEFAULT_SETTINGS } from "./config";
import { PLUGINS, pluginById } from "./plugins";
import {
  activeTools,
  ensureWorkspaceSafely,
  hostInfo,
  resolveWorkspace,
  TOOLS,
} from "./tools";
import {
  chatStream,
  OllamaError,
  OllamaMessage,
  OllamaToolCall,
} from "./ollama";
import type { AgentEvent, AssistantMeta, ToolCallRecord } from "@/lib/types";

export const runningAgents = new Map<string, AbortController>();

export function abortAgent(conversationId: string): boolean {
  const ac = runningAgents.get(conversationId);
  if (ac) {
    ac.abort();
    return true;
  }
  return false;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

async function nextSeq(conversationId: string): Promise<number> {
  const rows = await db
    .select({ m: sql<number>`coalesce(max(${messages.seq}), -1)` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));
  return (rows[0]?.m ?? -1) + 1;
}

async function insertMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  meta: AssistantMeta | null
): Promise<void> {
  const seq = await nextSeq(conversationId);
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId,
    seq,
    role,
    content,
    meta: meta as Record<string, unknown> | null,
  });
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/** Loads prior messages and reshapes them into Ollama chat messages. */
async function loadHistory(conversationId: string): Promise<OllamaMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.seq));

  const out: OllamaMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      out.push({ role: "user", content: row.content });
      continue;
    }
    if (row.role === "assistant") {
      const meta = (row.meta ?? {}) as AssistantMeta;
      const msg: OllamaMessage = { role: "assistant", content: row.content };
      if (meta.toolCalls?.length) {
        msg.tool_calls = meta.toolCalls.map(
          (tc): OllamaToolCall => ({
            function: { name: tc.name, arguments: tc.args ?? {} },
          })
        );
      }
      out.push(msg);
      if (meta.toolCalls?.length) {
        for (const tc of meta.toolCalls) {
          out.push({ role: "tool", name: tc.name, content: tc.result });
        }
      }
    }
  }
  return out;
}

/** Keeps the last n entries without orphaning tool-response groups. */
function sliceHistory(msgs: OllamaMessage[], n: number): OllamaMessage[] {
  if (msgs.length <= n) return msgs;
  const sliced = msgs.slice(msgs.length - n);
  let start = 0;
  while (start < sliced.length) {
    const e = sliced[start];
    if (!e) break;
    if (e.role === "tool") {
      start++;
      continue;
    }
    if (e.role === "assistant" && !e.tool_calls?.length) {
      start++;
      continue;
    }
    if (e.role === "assistant" && e.tool_calls?.length) {
      const need = e.tool_calls.length;
      const following = sliced.slice(start + 1, start + 1 + need);
      const intact =
        following.length === need && following.every((f) => f.role === "tool");
      if (!intact) {
        // drop the broken group and keep trimming
        start += 1 + following.length;
        continue;
      }
    }
    break;
  }
  return sliced.slice(start);
}

async function buildSystemPrompt(): Promise<string> {
  const s = await getSettings();
  const workspace = resolveWorkspace(s);
  const parts: string[] = [s.systemPrompt || DEFAULT_SETTINGS.systemPrompt];

  const active = activeTools(s).map((t) => t.name);
  for (const p of PLUGINS) {
    if (s.plugins[p.id] && p.tools.some((t) => active.includes(t))) {
      parts.push(`Enabled capability [${p.name}]: ${p.systemNote}`);
    }
  }

  const skillRows = s.activeSkills.length
    ? await db.select().from(skills).where(sql`${skills.id} IN (${sql.join(s.activeSkills.map((id) => sql`${id}`), sql`, `)})`)
    : [];
  const enabledSkills = skillRows.filter((sk) => sk.enabled && s.activeSkills.includes(sk.id));
  for (const sk of enabledSkills) {
    parts.push(
      `---\n## Skill: ${sk.name}\n${sk.description}\n${sk.body}`
    );
  }

  parts.push(
    `---\nEnvironment: ${hostInfo()}\nWorkspace directory (file tools & bash cwd): ${workspace}\nOllama server: ${s.ollamaUrl} | model: ${s.model}`
  );
  return parts.join("\n\n");
}

export interface RunAgentOptions {
  conversationId: string;
  userInput: string;
  model?: string;
  emit: (ev: AgentEvent) => void;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { conversationId, userInput, emit } = opts;
  const started = Date.now();
  const ac = new AbortController();
  runningAgents.set(conversationId, ac);

  const s = await getSettings();
  const workspace = resolveWorkspace(s);
  await ensureWorkspaceSafely(workspace);
  const model = opts.model || s.model;

  let aborted = false;
  const toolCalls: ToolCallRecord[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let steps = 0;
  let finalContent = "";
  let failed: string | null = null;

  try {
    await insertMessage(conversationId, "user", userInput, null);

    // auto-title from first user message
    const convRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const conv = convRows[0];
    if (conv && (conv.title === "New conversation" || !conv.title.trim())) {
      const title = userInput.replace(/\s+/g, " ").trim().slice(0, 56);
      if (title) {
        await db
          .update(conversations)
          .set({ title: title + (userInput.length > 56 ? "…" : ""), model })
          .where(eq(conversations.id, conversationId));
      } else {
        await db
          .update(conversations)
          .set({ model })
          .where(eq(conversations.id, conversationId));
      }
    } else if (conv) {
      await db
        .update(conversations)
        .set({ model })
        .where(eq(conversations.id, conversationId));
    }

    const systemPrompt = await buildSystemPrompt();
    let history = await loadHistory(conversationId);
    const chatMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...sliceHistory(history, s.contextMessages),
    ];

    const tools = activeTools(s);
    const toolSchemas = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    const toolMap = new Map(TOOLS.map((t) => [t.name, t]));

    for (let step = 0; step < s.maxToolSteps; step++) {
      steps = step + 1;
      const { message, stats } = await chatStream(
        s,
        {
          model,
          messages: chatMessages,
          tools: toolSchemas,
          think: s.think,
        },
        ac.signal,
        (delta) => emit({ type: "delta", content: delta })
      );
      promptTokens += stats.promptEvalCount;
      completionTokens += stats.evalCount;

      const tcs = message.tool_calls ?? [];
      if (tcs.length === 0) {
        finalContent = (message.content ?? "").trim();
        break;
      }

      // record the assistant turn that requested tools
      chatMessages.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: tcs,
      });

      for (let i = 0; i < tcs.length; i++) {
        const call = tcs[i];
        if (!call) continue;
        const fn = call.function;
        const name = fn?.name ?? "unknown";
        const args = (fn?.arguments ?? {}) as Record<string, unknown>;
        const id = toolCalls.length;
        emit({ type: "tool_start", id, name, args });

        let ok = true;
        let result: string;
        let truncated = false;
        const t0 = Date.now();
        const def = toolMap.get(name);
        if (!def) {
          ok = false;
          result = `Tool '${name}' is not available. Available: ${[...toolMap.keys()].join(", ")}`;
        } else {
          try {
            const r = await def.run(args, { settings: s, workspace });
            ok = r.ok;
            const t = truncateOutput(r.output, s.maxToolOutputChars);
            result = t.output;
            truncated = t.truncated;
          } catch (e) {
            ok = false;
            result = `Tool '${name}' threw: ${(e as Error).message}`;
          }
        }
        const ms = Date.now() - t0;
        const record: ToolCallRecord = { name, args, result, ok, ms, truncated };
        toolCalls.push(record);
        emit({ type: "tool_end", id, name, result, ok, ms, truncated });

        chatMessages.push({ role: "tool", name, content: result });
      }
    }

    // Give the model one final response pass after the tool budget is exhausted.
    // Tool calls are disabled so it must summarize the results instead of looping.
    if (steps >= s.maxToolSteps && !finalContent) {
      const { message, stats } = await chatStream(
        s,
        {
          model,
          messages: chatMessages,
          tools: [],
          think: s.think,
        },
        ac.signal,
        (delta) => emit({ type: "delta", content: delta })
      );
      promptTokens += stats.promptEvalCount;
      completionTokens += stats.evalCount;
      finalContent = (message.content ?? "").trim();
    }
  } catch (e) {
    if (isAbort(e)) {
      aborted = true;
    } else {
      failed =
        e instanceof OllamaError
          ? e.message
          : `Harness error: ${(e as Error).message}`;
      emit({ type: "error", message: failed });
    }
  }

  try {
    await insertMessage(conversationId, "assistant", finalContent, {
      toolCalls,
      promptTokens,
      completionTokens,
      totalMs: Date.now() - started,
      steps,
      aborted,
    });
  } catch (e) {
    console.error("persist assistant message failed", e);
  }

  emit({
    type: "done",
    content: finalContent,
    toolCalls,
    steps,
    aborted,
    promptTokens,
    completionTokens,
    totalMs: Date.now() - started,
  });
  runningAgents.delete(conversationId);
}

function truncateOutput(output: string, max: number): { output: string; truncated: boolean } {
  if (output.length <= max) return { output, truncated: false };
  return {
    output: output.slice(0, max) + `\n…[truncated ${output.length - max} more chars]`,
    truncated: true,
  };
}

export function pluginNotesSummary() {
  return PLUGINS.map((p) => ({ id: p.id, name: p.name, note: p.systemNote }));
}

export function describePlugin(id: string) {
  return pluginById(id);
}
