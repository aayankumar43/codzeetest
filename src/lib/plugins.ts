import { db } from "@/db";
import { plugins } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface PluginDef {
  id: number;
  name: string;
  slug: string;
  version: string;
  description: string;
  config: any;
  skills: any[];
  status: string;
}

export async function listPlugins() {
  return db.select().from(plugins).orderBy(plugins.updatedAt);
}

export async function getPlugin(slug: string) {
  const res = await db.select().from(plugins).where(eq(plugins.slug, slug)).limit(1);
  return res[0] || null;
}

export async function createPlugin(data: Partial<typeof plugins.$inferInsert>) {
  const [r] = await db.insert(plugins).values({
    name: data.name || "New Plugin",
    slug: data.slug || `plugin-${Date.now()}`,
    description: data.description || "",
    source: data.source || "",
    config: data.config || {},
    skills: data.skills || [],
    status: data.status || "disabled",
  }).returning();
  return r;
}

export async function updatePlugin(id: number, data: Partial<typeof plugins.$inferInsert>) {
  await db.update(plugins).set({ ...data, updatedAt: new Date() }).where(eq(plugins.id, id));
}

export function getPluginCapabilities(pl: PluginDef) {
  return pl.skills || [];
}
