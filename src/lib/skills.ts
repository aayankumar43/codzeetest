import { db } from "@/db";
import { skills, models, plugins, tools } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { chatOllama, type ChatMessage } from "./ollama";
import { executeToolCall } from "./tools";

export async function getSkill(slug: string) {
  const res = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
  return res[0] || null;
}

export async function listSkills() {
  return db.select().from(skills).orderBy(skills.updatedAt);
}

export async function buildSkillPrompt(skill: any, messages: ChatMessage[] = []) {
  let system = skill.promptTemplate || `You are an expert assistant for: ${skill.name}.`;
  if (skill.parameters?.systemInstruction) system = skill.parameters.systemInstruction;

  const toolSchemas: any[] = [];
  if (skill.toolIds && skill.toolIds.length) {
    const ts = await db.select().from(tools).where(inArray(tools.id, skill.toolIds));
    for (const t of ts) {
      toolSchemas.push({
        type: "function",
        function: {
          name: t.slug,
          description: t.description || t.name,
          parameters: t.schema || { type: "object", properties: {} },
        },
      });
    }
  }

  return { system, toolSchemas };
}

export async function runSkillChat(
  skillId: number,
  messages: ChatMessage[],
  conversationId?: number
) {
  const skill = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1).then(r => r[0]);
  if (!skill) throw new Error("Skill not found");

  const modelRow = skill.modelId ? await db.select().from(models).where(eq(models.id, skill.modelId)).limit(1).then(r => r[0]) : null;
  if (!modelRow) throw new Error("Skill has no linked model. Please configure in Skills.");

  const { system, toolSchemas } = await buildSkillPrompt(skill, messages);
  const allMessages: ChatMessage[] = [{ role: "system", content: system }, ...messages];

  // Determine if using Ollama, Omniroute, or OpenRouter
  const useOmniroute = modelRow.source === "omniroute" && modelRow.omnirouteModelId;
  const useOpenRouter = modelRow.source === "openrouter" && modelRow.openrouterModelId;

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    let response: any;

    if (useOmniroute) {
      const { chatOmniroute, getOmnirouteConfig } = await import("./omniroute");
      const orCfg = await getOmnirouteConfig();
      response = await chatOmniroute({
        model: modelRow.omnirouteModelId!,
        messages: allMessages.map(m => ({
          role: m.role as "system" | "user" | "assistant" | "tool",
          content: m.content,
          tool_calls: (m as any).tool_calls,
        })),
        temperature: (skill.parameters as any)?.temperature ?? 0.7,
        top_p: (skill.parameters as any)?.top_p ?? 0.9,
        tools: toolSchemas.length ? toolSchemas : undefined,
      }, orCfg);
      // Convert OpenAI format to Ollama-like format
      response = {
        message: {
          role: response.choices?.[0]?.message?.role || "assistant",
          content: response.choices?.[0]?.message?.content || "",
          tool_calls: response.choices?.[0]?.message?.tool_calls,
        },
      };
    } else if (useOpenRouter) {
      const { chatOpenRouter, getOpenRouterConfig } = await import("./openrouter");
      const opCfg = await getOpenRouterConfig();
      response = await chatOpenRouter({
        model: modelRow.openrouterModelId!,
        messages: allMessages.map(m => ({
          role: m.role as "system" | "user" | "assistant" | "tool",
          content: m.content,
          tool_calls: (m as any).tool_calls,
        })),
        temperature: (skill.parameters as any)?.temperature ?? 0.7,
        top_p: (skill.parameters as any)?.top_p ?? 0.9,
        tools: toolSchemas.length ? toolSchemas : undefined,
      }, opCfg);
      response = {
        message: {
          role: response.choices?.[0]?.message?.role || "assistant",
          content: response.choices?.[0]?.message?.content || "",
          tool_calls: response.choices?.[0]?.message?.tool_calls,
        },
      };
    } else {
      const { getOllamaConfig } = await import("./ollama");
      const cfg = await getOllamaConfig();
      response = await chatOllama({
        model: modelRow.ollamaName!,
        messages: allMessages,
        options: { temperature: (skill.parameters as any)?.temperature ?? 0.7, top_p: (skill.parameters as any)?.top_p ?? 0.9 },
        tools: toolSchemas.length ? toolSchemas : undefined,
      }, cfg);
    }

    const assistantMsg = response.message || { role: "assistant", content: response.response || "" };
    const msg: ChatMessage = { role: "assistant", content: assistantMsg.content };
    if ((assistantMsg as any).tool_calls) (msg as any).tool_calls = (assistantMsg as any).tool_calls;
    allMessages.push(msg);

    const toolCalls = (assistantMsg as any).tool_calls || [];
    if (toolCalls.length > 0) {
      const results: any[] = [];
      for (const call of toolCalls) {
        const exec = await executeToolCall(call, conversationId);
        results.push({
          tool_call_id: call.id,
          role: "tool" as const,
          name: call.function.name,
          content: JSON.stringify(exec.ok ? exec.result : exec.error),
        });
      }
      for (const r of results) allMessages.push(r as ChatMessage);
      // Continue loop to get final response with tool results
      continue;
    }

    await db.update(skills).set({ usageCount: (skill.usageCount || 0) + 1 }).where(eq(skills.id, skillId));
    return { response: assistantMsg, messages: allMessages };
  }

  throw new Error("Skill execution exceeded retries");
}
