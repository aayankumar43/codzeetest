import { NextResponse } from "next/server";
import { listOpenRouterModels, getOpenRouterConfig } from "@/lib/openrouter";

export async function GET() {
  const cfg = await getOpenRouterConfig();
  const list = await listOpenRouterModels(cfg);
  return NextResponse.json({
    ok: list.ok,
    openrouterConnected: list.ok,
    openrouterError: list.error,
    models: list.models,
    modelCount: list.models.length,
  });
}
