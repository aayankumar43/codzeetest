import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, messages, skills, models } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const [c] = await db.select().from(conversations).where(eq(conversations.id, parseInt(id))).limit(1);
    if (!c) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, parseInt(id))).orderBy(messages.createdAt);
    return NextResponse.json({ ok: true, conversation: c, messages: msgs });
  }
  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(50);
  return NextResponse.json({ ok: true, conversations: rows });
}
