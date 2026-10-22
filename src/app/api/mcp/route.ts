import { NextResponse } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createMCPConfig, listMCPConfigs, updateMCPConfig, deleteMCPConfig, connectMCP, listMCPTools } from "@/lib/mcp";

export async function GET() {
  return NextResponse.json({ ok: true, servers: await listMCPConfigs() });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const action = b.action || "create";

  if (action === "create") {
    const r = await createMCPConfig({ ...b, args: b.args || [], env: b.env || {} } as any);
    return NextResponse.json({ ok: true, server: r });
  }

  if (action === "connect") {
    const config = await db.select().from(mcpServers).where(eq(mcpServers.id, b.id)).limit(1).then(r => r[0]);
    if (!config) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const res = await connectMCP({ ...config, args: (config.args || []) as string[], env: (config.env || {}) as Record<string, string>, transport: config.transport || "stdio" } as any);
    return NextResponse.json({ ok: res.ok, error: (res as any).error, serverId: config.id, client: res.ok ? true : false });
  }

  if (action === "list-tools" && b.id) {
    const cfg = await db.select().from(mcpServers).where(eq(mcpServers.id, b.id)).limit(1).then(r => r[0]);
    if (!cfg) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const res = await connectMCP({ ...cfg, args: (cfg.args || []) as string[], env: (cfg.env || {}) as Record<string, string>, transport: cfg.transport || "stdio" } as any);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error });
    const tools = await listMCPTools(res.client);
    return NextResponse.json({ ok: true, tools, serverId: cfg.id });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
  await updateMCPConfig(b.id, b);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (id) await deleteMCPConfig(id);
  return NextResponse.json({ ok: true });
}
