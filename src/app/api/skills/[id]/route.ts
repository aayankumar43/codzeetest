import { db } from "@/db";
import { skills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function toSkill(row: (typeof skills.$inferSelect)) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    tools: row.tools,
    enabled: row.enabled,
    builtin: row.builtin,
  };
}

export async function PUT(req: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  let name: string | undefined;
  let description: string | undefined;
  let body: string | undefined;
  let tools: string[] | undefined;
  let enabled: boolean | undefined;
  try {
    const b = (await req.json()) as {
      name?: string;
      description?: string;
      body?: string;
      tools?: string[];
      enabled?: boolean;
    };
    name = b.name?.trim();
    description = b.description?.trim();
    body = b.body;
    tools = Array.isArray(b.tools) ? b.tools.map(String) : undefined;
    enabled = b.enabled;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const existing = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  const row = existing[0];
  if (!row) return Response.json({ error: "Skill not found" }, { status: 404 });
  const nextName = name ?? row.name;
  if (!nextName) return Response.json({ error: "Skill name cannot be empty" }, { status: 400 });
  const dup = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.name, nextName))
    .limit(1);
  if (dup.length && dup[0].id !== id) {
    return Response.json({ error: "A skill with this name already exists" }, { status: 409 });
  }
  const updated = await db
    .update(skills)
    .set({
      name: nextName,
      description: description ?? row.description,
      body: body ?? row.body,
      tools: tools ?? row.tools,
      enabled: enabled ?? row.enabled,
    })
    .where(eq(skills.id, id))
    .returning();
  return Response.json({ skill: toSkill(updated[0]) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  const row = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  if (!row.length) return Response.json({ error: "Skill not found" }, { status: 404 });
  if (row[0].builtin) {
    // builtins can be disabled but not deleted
    await db.update(skills).set({ enabled: false }).where(eq(skills.id, id));
    return Response.json({ ok: true, note: "Built-in skill disabled instead of deleted" });
  }
  await db.delete(skills).where(eq(skills.id, id));
  return Response.json({ ok: true });
}
