import { db } from "@/db";
import { agents, agentExecutions, models, skills, tools, plugins, mcpServers } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { chatOllama, getOllamaConfig, type ChatMessage } from "./ollama";
import { chatOmniroute, getOmnirouteConfig } from "./omniroute";
import { executeToolBySlug } from "./tools";

export async function listAgents() {
  return db.select().from(agents).orderBy(desc(agents.updatedAt));
}

export async function getAgent(id: number) {
  const res = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return res[0] || null;
}

export async function createAgent(data: Partial<typeof agents.$inferInsert>) {
  const [r] = await db.insert(agents).values({
    name: data.name || "New Agent",
    slug: data.slug || `agent-${Date.now()}`,
    description: data.description || "",
    systemPrompt: data.systemPrompt || "",
    modelId: data.modelId || null,
    skillId: data.skillId || null,
    toolIds: data.toolIds || [],
    pluginIds: data.pluginIds || [],
    mcpServerIds: data.mcpServerIds || [],
    triggerMode: data.triggerMode || "manual",
    scheduleCron: data.scheduleCron || null,
    webhookUrl: data.webhookUrl || null,
    maxIterations: data.maxIterations || 10,
    timeoutMs: data.timeoutMs || 60000,
    parameters: data.parameters || { temperature: 0.7, top_p: 0.9, max_tokens: 1024 },
    status: data.status || "disabled",
  }).returning();
  return r;
}

export async function updateAgent(id: number, data: Partial<typeof agents.$inferInsert>) {
  await db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id));
}

export async function deleteAgent(id: number) {
  await db.delete(agents).where(eq(agents.id, id));
}

export async function listAgentExecutions(agentId?: number) {
  if (agentId) {
    return db.select().from(agentExecutions)
      .where(eq(agentExecutions.agentId, agentId))
      .orderBy(desc(agentExecutions.startedAt))
      .limit(50);
  }
  return db.select().from(agentExecutions).orderBy(desc(agentExecutions.startedAt)).limit(100);
}

export async function getAgentExecution(id: number) {
  const res = await db.select().from(agentExecutions).where(eq(agentExecutions.id, id)).limit(1);
  return res[0] || null;
}

export interface AgentExecutionResult {
  ok: boolean;
  executionId: number;
  output?: string;
  steps?: any[];
  error?: string;
}

export async function executeAgent(agentId: number, input?: string): Promise<AgentExecutionResult> {
  const agent = await getAgent(agentId);
  if (!agent) return { ok: false, executionId: 0, error: "Agent not found" };
  if (agent.status === "disabled") return { ok: false, executionId: 0, error: "Agent is disabled" };

  const [execution] = await db.insert(agentExecutions).values({
    agentId,
    input: input || null,
    status: "running",
  }).returning();

  const start = Date.now();
  const steps: any[] = [];
  const maxIterations = agent.maxIterations || 10;
  const timeout = agent.timeoutMs || 60000;
  let iteration = 0;

  try {
    const modelRow = agent.modelId ? await db.select().from(models).where(eq(models.id, agent.modelId)).limit(1).then(r => r[0]) : null;
    const skillRow = agent.skillId ? await db.select().from(skills).where(eq(skills.id, agent.skillId)).limit(1).then(r => r[0]) : null;

    // Load tools for this agent
    const toolIds = (agent.toolIds || []) as number[];
    const agentTools = toolIds.length > 0
      ? await db.select().from(tools).where(inArray(tools.id, toolIds))
      : [];

    const toolSchemas = agentTools.map(t => ({
      type: "function" as const,
      function: {
        name: t.slug,
        description: t.description || t.name,
        parameters: t.schema || { type: "object", properties: {} },
      },
    }));

    // Build messages
    const systemPrompt = agent.systemPrompt || `You are an autonomous agent named ${agent.name}. ${agent.description || "Perform your assigned tasks."}`;
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    if (input) {
      messages.push({ role: "user", content: input });
    } else {
      messages.push({ role: "user", content: "Execute your assigned task now." });
    }

    // Get config
    const ollamaCfg = await getOllamaConfig();
    const omnirouteCfg = await getOmnirouteConfig();
    const useOmniroute = modelRow?.source === "omniroute" && modelRow.omnirouteModelId;
    const modelName = useOmniroute ? modelRow!.omnirouteModelId! : modelRow?.ollamaName;

    let iteration = 0;
    let finalResponse = "";

    while (iteration < maxIterations && Date.now() - start < timeout) {
      iteration++;
      steps.push({ iteration, action: "inference", status: "started" });

      let response: any;
      if (useOmniroute) {
        response = await chatOmniroute({
          model: modelName,
          messages: messages.map(m => ({ role: m.role, content: m.content, tool_calls: (m as any).tool_calls })),
          tools: toolSchemas.length ? toolSchemas : undefined,
          ...(agent.parameters as any),
        }, omnirouteCfg);
        const choice = response.choices?.[0]?.message;
        response = {
          message: {
            role: choice?.role || "assistant",
            content: choice?.content || "",
            tool_calls: choice?.tool_calls,
          },
        };
      } else {
        response = await chatOllama({
          model: modelName || "llama3",
          messages,
          options: agent.parameters as any,
          tools: toolSchemas.length ? toolSchemas : undefined,
        }, ollamaCfg);
      }

      const assistantMsg = response.message || { role: "assistant", content: "" };
      messages.push({
        role: "assistant",
        content: assistantMsg.content || "",
        tool_calls: (assistantMsg as any).tool_calls,
      });

      const toolCalls = (assistantMsg as any).tool_calls || [];
      if (toolCalls.length === 0) {
        finalResponse = assistantMsg.content || "";
        steps.push({ iteration, action: "complete", content: finalResponse });
        break;
      }

      // Execute tools
      for (const call of toolCalls) {
        steps.push({ iteration, action: "tool_call", tool: call.function?.name, args: call.function?.arguments });
        try {
          const args = JSON.parse(call.function?.arguments || "{}");
          const result = await executeToolBySlug(call.function.name, args);
          messages.push({
            role: "tool",
            content: JSON.stringify(result.ok ? result.result : result.error),
            tool_call_id: call.id,
          });
          steps.push({ iteration, action: "tool_result", tool: call.function?.name, result: result.ok ? result.result : result.error });
        } catch (e: any) {
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: e.message }),
            tool_call_id: call.id,
          });
          steps.push({ iteration, action: "tool_error", tool: call.function?.name, error: e.message });
        }
      }
    }

    if (!finalResponse) {
      finalResponse = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n") || "Agent completed but no response generated.";
    }

    const duration = Date.now() - start;
    await db.update(agentExecutions).set({
      output: finalResponse,
      steps,
      status: "completed",
      durationMs: duration,
      iterationCount: iteration,
      completedAt: new Date(),
    }).where(eq(agentExecutions.id, execution.id));

    await db.update(agents).set({
      executionCount: (agent.executionCount || 0) + 1,
      lastRunAt: new Date(),
    }).where(eq(agents.id, agentId));

    return { ok: true, executionId: execution.id, output: finalResponse, steps };
  } catch (e: any) {
    const duration = Date.now() - start;
    await db.update(agentExecutions).set({
      status: "failed",
      durationMs: duration,
      iterationCount: iteration,
      completedAt: new Date(),
    }).where(eq(agentExecutions.id, execution.id));

    return { ok: false, executionId: execution.id, error: e.message || String(e) };
  }
}

// Agent execution helper utilities
