import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface MCPServerConfig {
  id: number;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  transport: string;
  url?: string;
}

export async function listMCPConfigs() {
  return db.select().from(mcpServers).orderBy(mcpServers.updatedAt);
}

export async function getMCPConfig(id: number) {
  const res = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
  return res[0] || null;
}

export async function createMCPConfig(data: Partial<typeof mcpServers.$inferInsert>) {
  const [r] = await db.insert(mcpServers).values({
    name: data.name || "MCP Server",
    command: data.command || "node",
    args: data.args || [],
    env: data.env || {},
    transport: data.transport || "stdio",
    url: data.url || null,
    status: "disconnected",
  }).returning();
  return r;
}

export async function updateMCPConfig(id: number, data: Partial<typeof mcpServers.$inferInsert>) {
  await db.update(mcpServers).set({ ...data, updatedAt: new Date() }).where(eq(mcpServers.id, id));
}

export async function deleteMCPConfig(id: number) {
  await db.delete(mcpServers).where(eq(mcpServers.id, id));
}

export async function connectMCP(serverConfig: MCPServerConfig) {
  try {
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: { ...(process.env as Record<string, string>), ...(serverConfig.env || {}) },
    });
    const client = new Client({ name: "ollama-harness", version: "1.0.0" });
    await client.connect(transport);
    await db.update(mcpServers).set({ status: "connected", lastPing: new Date() }).where(eq(mcpServers.id, serverConfig.id));
    return { ok: true, client, transport };
  } catch (e: any) {
    await db.update(mcpServers).set({ status: "error" }).where(eq(mcpServers.id, serverConfig.id));
    return { ok: false, error: e.message || String(e) };
  }
}

export async function listMCPTools(client: any) {
  try {
    const result = await client.request({ method: "tools/list" }, undefined as any);
    return (result?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || {},
    }));
  } catch (e: any) {
    return [];
  }
}

export async function callMCPTool(client: any, name: string, args: any) {
  try {
    const result = await client.request({ method: "tools/call", params: { name, arguments: args } }, undefined as any);
    return { ok: true, result: result?.content || result };
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}
