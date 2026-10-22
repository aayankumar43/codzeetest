import { NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(appConfig).orderBy(appConfig.key);
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;
  return NextResponse.json({ ok: true, config: cfg });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const key = b.key || "ollama_host";
  const value = b.value || "";
  const existing = await db.select().from(appConfig).where(eq(appConfig.key, key)).limit(1);
  if (existing.length) {
    await db.update(appConfig).set({ value, updatedAt: new Date() }).where(eq(appConfig.key, key));
  } else {
    await db.insert(appConfig).values({ key, value });
  }
  return NextResponse.json({ ok: true, key, value });
}
