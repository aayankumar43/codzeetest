import { NextResponse } from "next/server";
import { listOllamaModels, getOllamaConfig } from "@/lib/ollama";

export async function GET() {
  const cfg = await getOllamaConfig();
  const list = await listOllamaModels(cfg);
  return NextResponse.json({ ok: list.ok, ollamaConnected: list.ok, ollamaError: list.error, models: list.models });
}
