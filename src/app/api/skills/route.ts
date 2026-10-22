import { NextResponse } from "next/server";
import { db } from "@/db";
import { skills, models, tools, plugins } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { runSkillChat } from "@/lib/skills";

export async function GET() {
  const rows = await db.select().from(skills).orderBy(skills.updatedAt);
  const allModels = await db.select().from(models);
  const allTools = await db.select().from(tools);
  const allPlugins = await db.select().from(plugins);
  const enriched = rows.map((s: any) => ({
    ...s,
    modelName: allModels.find((m: any) => m.id === s.modelId)?.name || null,
    toolCount: Array.isArray(s.toolIds) ? s.toolIds.length : 0,
    pluginCount: Array.isArray(s.pluginIds) ? s.pluginIds.length : 0,
  }));
  return NextResponse.json({ ok: true, skills: enriched, models: allModels, tools: allTools, plugins: allPlugins });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const [r] = await db.insert(skills).values({
    name: b.name || "New Skill",
    slug: b.slug || `skill-${Date.now()}`,
    description: b.description || "",
    promptTemplate: b.promptTemplate || "",
    modelId: b.modelId || null,
    toolIds: b.toolIds || [],
    pluginIds: b.pluginIds || [],
    parameters: b.parameters || {},
    status: b.status || "draft",
  }).returning();
  return NextResponse.json({ ok: true, skill: r });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
  await db.update(skills).set({ ...b, updatedAt: new Date() }).where(eq(skills.id, b.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (id) await db.delete(skills).where(eq(skills.id, id));
  return NextResponse.json({ ok: true });
}
