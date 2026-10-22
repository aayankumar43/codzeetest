export interface OmnirouteConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export const defaultOmnirouteConfig: OmnirouteConfig = {
  baseUrl: process.env.OMNIRROUTE_BASE_URL || "http://localhost:20128/v1",
  apiKey: process.env.OMNIRROUTE_API_KEY || "",
  timeoutMs: 60000,
};

export async function getOmnirouteConfig(): Promise<OmnirouteConfig> {
  try {
    const { db } = await import("@/db");
    const { appConfig } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(appConfig).where(eq(appConfig.key, "omniroute_base_url")).limit(1);
    const apiKeyRows = await db.select().from(appConfig).where(eq(appConfig.key, "omniroute_api_key")).limit(1);
    return {
      baseUrl: rows[0]?.value || defaultOmnirouteConfig.baseUrl,
      apiKey: apiKeyRows[0]?.value || defaultOmnirouteConfig.apiKey,
      timeoutMs: defaultOmnirouteConfig.timeoutMs,
    };
  } catch {
    return defaultOmnirouteConfig;
  }
}

export interface OmnirouteModel {
  id: string;
  object: string;
  owned_by: string;
  created?: number;
}

export async function listOmnirouteModels(config: OmnirouteConfig = defaultOmnirouteConfig) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    const res = await fetch(`${config.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, models: [] };
    const data = await res.json();
    return {
      ok: true,
      models: (data.data || []).map((m: OmnirouteModel) => ({
        id: m.id,
        owned_by: m.owned_by,
        object: m.object,
      })),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Connection refused", models: [] };
  }
}

export interface OmnirouteMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface OmnirouteChatRequest {
  model: string;
  messages: OmnirouteMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  tools?: any[];
  tool_choice?: string | { type: "function"; function: { name: string } };
  max_tokens?: number;
}

export async function chatOmniroute(req: OmnirouteChatRequest, config: OmnirouteConfig = defaultOmnirouteConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...req, stream: false }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Omniroute HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
