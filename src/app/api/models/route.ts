import { NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { listOllamaModels, getOllamaConfig, pullOllamaModel, deleteOllamaModel } from "@/lib/ollama";
import { listOmnirouteModels, getOmnirouteConfig } from "@/lib/omniroute";
import { listOpenRouterModels, getOpenRouterConfig } from "@/lib/openrouter";
import { eq } from "drizzle-orm";

export async function GET() {
  const cfg = await getOllamaConfig();
  const orCfg = await getOmnirouteConfig();
  const opCfg = await getOpenRouterConfig();
  const [dbModels, ollama, omniroute, openrouter] = await Promise.all([
    db.select().from(models).orderBy(models.updatedAt),
    listOllamaModels(cfg),
    listOmnirouteModels(orCfg),
    listOpenRouterModels(opCfg),
  ]);

  const ollamaNames = new Set((ollama.models || []).map((m: any) => m.name || m.tag));
  const omnirouteIds = new Set((omniroute.models || []).map((m: any) => m.id));
  const openrouterIds = new Set((openrouter.models || []).map((m: any) => m.id));

  const enriched = dbModels.map((m: any) => {
    if (m.source === "omniroute") {
      return {
        ...m,
        omnirouteDetected: omnirouteIds.has(m.omnirouteModelId),
        omnirouteStatus: omniroute.ok ? (omnirouteIds.has(m.omnirouteModelId) ? "available" : "not_found") : "unknown",
      };
    }
    if (m.source === "openrouter") {
      return {
        ...m,
        openrouterDetected: openrouterIds.has(m.openrouterModelId),
        openrouterStatus: openrouter.ok ? (openrouterIds.has(m.openrouterModelId) ? "available" : "not_found") : "unknown",
      };
    }
    return {
      ...m,
      ollamaDetected: ollamaNames.has(m.ollamaName) || ollamaNames.has(m.name),
      ollamaStatus: ollama.ok ? (ollamaNames.has(m.ollamaName) ? "available" : "not_found") : "unknown",
    };
  });

  return NextResponse.json({
    ok: true,
    models: enriched,
    ollama: { ok: ollama.ok, error: ollama.error, available: ollama.models },
    omniroute: { ok: omniroute.ok, error: omniroute.error, available: omniroute.models },
    openrouter: { ok: openrouter.ok, error: openrouter.error, available: openrouter.models, count: openrouter.models?.length || 0 },
  });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (id) await db.delete(models).where(eq(models.id, id));
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const cfg = await getOllamaConfig();
  if (action === "pull") {
    const modelName = body.name || body.ollamaName;
    if (!modelName) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    const res = await pullOllamaModel(modelName, cfg);
    return NextResponse.json({ ok: true, pulling: modelName, status: res.status });
  }

  if (action === "delete") {
    const name = body.name || body.ollamaName;
    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    const res = await deleteOllamaModel(name, cfg);
    return NextResponse.json({ ok: true, deleted: name, status: res.status });
  }

  // Add to DB - support both Ollama and Omniroute
  const { ollamaName, omnirouteModelId, name, description, tag, params, source } = body;
  const modelSource = source || "ollama";

  if (modelSource === "omniroute") {
    if (!omnirouteModelId) return NextResponse.json({ ok: false, error: "omnirouteModelId required" }, { status: 400 });
    const existing = await db.select().from(models).where(eq(models.omnirouteModelId, omnirouteModelId)).limit(1);
    if (existing.length) return NextResponse.json({ ok: false, error: "Model already exists" }, { status: 409 });
    const [r] = await db.insert(models).values({
      ollamaName: null,
      omnirouteModelId,
      openrouterModelId: null,
      name: name || omnirouteModelId,
      description: description || "",
      tag: tag || "latest",
      source: "omniroute",
      params: params || { temperature: 0.7, top_p: 0.9 },
      status: "not_found",
    }).returning();
    return NextResponse.json({ ok: true, model: r });
  }

  if (modelSource === "openrouter") {
    const openrouterModelId: string | undefined = body.openrouterModelId;
    if (!openrouterModelId) return NextResponse.json({ ok: false, error: "openrouterModelId required" }, { status: 400 });
    const existing = await db.select().from(models).where(eq(models.openrouterModelId, openrouterModelId)).limit(1);
    if (existing.length) return NextResponse.json({ ok: false, error: "Model already exists" }, { status: 409 });
    const [r] = await db.insert(models).values({
      ollamaName: null,
      omnirouteModelId: null,
      openrouterModelId,
      name: name || openrouterModelId,
      description: description || "",
      tag: tag || "latest",
      source: "openrouter",
      params: params || { temperature: 0.7, top_p: 0.9 },
      status: "not_found",
    }).returning();
    return NextResponse.json({ ok: true, model: r });
  }

  if (!ollamaName) return NextResponse.json({ ok: false, error: "ollamaName required" }, { status: 400 });

  const existing = await db.select().from(models).where(eq(models.ollamaName, ollamaName)).limit(1);
  if (existing.length) return NextResponse.json({ ok: false, error: "Model already exists" }, { status: 409 });

  const [r] = await db.insert(models).values({
    ollamaName,
    omnirouteModelId: null,
    name: name || ollamaName,
    description: description || "",
    tag: tag || "latest",
    source: "ollama",
    params: params || { temperature: 0.7, top_p: 0.9 },
    status: "not_found",
  }).returning();

  return NextResponse.json({ ok: true, model: r });
}
