import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(tools).orderBy(tools.updatedAt);
  return NextResponse.json({ ok: true, tools: rows });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const [r] = await db.insert(tools).values({
    name: b.name || "New Tool",
    slug: b.slug || `tool-${Date.now()}`,
    description: b.description || "",
    endpoint: b.endpoint || "",
    method: b.method || "GET",
    authType: b.authType || "none",
    authConfig: b.authConfig || {},
    headers: b.headers || {},
    schema: b.schema || { type: "object", properties: {} },
    status: "disconnected",
  }).returning();
  return NextResponse.json({ ok: true, tool: r });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
  await db.update(tools).set({ ...b, updatedAt: new Date() }).where(eq(tools.id, b.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (id) await db.delete(tools).where(eq(tools.id, id));
  return NextResponse.json({ ok: true });
}
