import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, agentExecutions, models, skills, tools, plugins, mcpServers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  executeAgent,
  listAgentExecutions,
  getAgentExecution,
} from "@/lib/agents";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id");

  if (action === "executions" && id) {
    const execs = await listAgentExecutions(parseInt(id));
    return NextResponse.json({ ok: true, executions: execs });
  }
  if (action === "execution" && id) {
    const exec = await getAgentExecution(parseInt(id));
    return NextResponse.json({ ok: true, execution: exec });
  }

  const agentList = await listAgents();
  const allModels = await db.select().from(models);
  const allSkills = await db.select().from(skills);
  const allTools = await db.select().from(tools);
  const allPlugins = await db.select().from(plugins);
  const allMcp = await db.select().from(mcpServers);

  return NextResponse.json({
    ok: true,
    agents: agentList,
    models: allModels,
    skills: allSkills,
    tools: allTools,
    plugins: allPlugins,
    mcpServers: allMcp,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  if (action === "create") {
    const agent = await createAgent(body);
    return NextResponse.json({ ok: true, agent });
  }

  if (action === "execute") {
    const result = await executeAgent(body.agentId, body.input);
    return NextResponse.json(result);
  }

  if (action === "stop") {
    const [exec] = await db.select().from(agentExecutions).where(eq(agentExecutions.id, body.executionId)).limit(1);
    if (exec) {
      await db.update(agentExecutions).set({ status: "stopped", completedAt: new Date() }).where(eq(agentExecutions.id, body.executionId));
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await updateAgent(body.id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.id) await deleteAgent(body.id);
  return NextResponse.json({ ok: true });
}
