import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ensureSeed } from "@/db/seed";
import { abortAgent } from "@/lib/harness/agent";
import type { AssistantMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  const convRows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  const conv = convRows[0];
  if (!conv) return Response.json({ error: "Conversation not found" }, { status: 404 });
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.seq));
  return Response.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    },
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      meta: (m.meta as AssistantMeta | null) ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  let title: string | undefined;
  try {
    const body = (await req.json()) as { title?: string; model?: string | null };
    title = body.title?.trim().slice(0, 80);
    const row = await db
      .update(conversations)
      .set({ ...(title ? { title } : {}), ...(body.model !== undefined ? { model: body.model } : {}) })
      .where(eq(conversations.id, id))
      .returning();
    if (!row.length) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  abortAgent(id);
  const rows = await db.delete(conversations).where(eq(conversations.id, id)).returning();
  return Response.json({ ok: true, deleted: rows.length });
}
