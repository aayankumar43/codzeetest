import { NextResponse } from "next/server";
import { db } from "@/db";
import { plugins } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  return NextResponse.json({ ok: true, plugins: await db.select().from(plugins).orderBy(plugins.updatedAt) });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const [r] = await db.insert(plugins).values({
    name: b.name || "New Plugin",
    slug: b.slug || `plugin-${Date.now()}`,
    description: b.description || "",
    source: b.source || "",
    config: b.config || {},
    skills: b.skills || [],
    status: b.status || "disabled",
  }).returning();
  return NextResponse.json({ ok: true, plugin: r });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
  await db.update(plugins).set({ ...b, updatedAt: new Date() }).where(eq(plugins.id, b.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (id) await db.delete(plugins).where(eq(plugins.id, id));
  return NextResponse.json({ ok: true });
}
