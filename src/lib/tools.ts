import { db } from "@/db";
import { tools, toolExecutions } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolResult {
  tool_call_id: string;
  role: "tool";
  name: string;
  content: string;
}

export async function executeToolBySlug(slug: string, args: any, conversationId?: number, messageId?: number) {
  const [tool] = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);
  if (!tool) return { error: `Tool ${slug} not found` };

  const payload = typeof args === "string" ? args : JSON.stringify(args);
  const start = Date.now();

  try {
    let result: any = null;
    const url = tool.endpoint || `http://localhost:8000/${slug}`;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...((tool.headers || {}) as any) };

    const ac = (tool.authConfig || {}) as any;
    if (tool.authType === "bearer" && ac.token) {
      headers["Authorization"] = `Bearer ${ac.token}`;
    } else if (tool.authType === "api_key" && ac.key && ac.headerName) {
      headers[ac.headerName] = ac.key;
    }

    if (tool.method === "POST" || !tool.endpoint) {
      const res = await fetch(url, {
        method: tool.method || "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      try { result = JSON.parse(text); } catch { result = text; }
    } else {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + new URLSearchParams(args as any).toString(), {
        method: tool.method || "GET",
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      try { result = JSON.parse(text); } catch { result = text; }
    }

    const duration = Date.now() - start;

    if (conversationId) {
      await db.insert(toolExecutions).values({
        toolId: tool.id,
        conversationId,
        messageId: messageId || null,
        requestPayload: args,
        responsePayload: result,
        status: "success",
        durationMs: duration,
      });
      await db.update(tools).set({ status: "connected", lastPing: new Date() }).where(eq(tools.id, tool.id));
    }

    return { ok: true, result, tool: tool.name, duration };
  } catch (e: any) {
    const duration = Date.now() - start;
    if (conversationId) {
      await db.insert(toolExecutions).values({
        toolId: tool.id,
        conversationId,
        messageId: messageId || null,
        requestPayload: args,
        responsePayload: { error: e.message },
        status: "error",
        durationMs: duration,
      });
      await db.update(tools).set({ status: "error" }).where(eq(tools.id, tool.id));
    }
    return { ok: false, error: e.message || String(e) };
  }
}

export async function executeToolCall(call: ToolCall, conversationId?: number, messageId?: number) {
  try {
    const args = JSON.parse(call.function.arguments || "{}");
    return await executeToolBySlug(call.function.name, args, conversationId, messageId);
  } catch (e: any) {
    return { ok: false, error: `Invalid args: ${e.message}` };
  }
}
