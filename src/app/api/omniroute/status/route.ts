import { NextResponse } from "next/server";
import { listOmnirouteModels, getOmnirouteConfig } from "@/lib/omniroute";

export async function GET() {
  const cfg = await getOmnirouteConfig();
  const list = await listOmnirouteModels(cfg);
  return NextResponse.json({ ok: list.ok, omnirouteConnected: list.ok, omnirouteError: list.error, models: list.models });
}
