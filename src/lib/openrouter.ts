export interface OpenRouterConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  referer?: string;
  appName?: string;
}

export const defaultOpenRouterConfig: OpenRouterConfig = {
  baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  timeoutMs: 60000,
  referer: typeof window !== "undefined" ? window.location.origin : "https://ollama-harness.local",
  appName: "Ollama Harness",
};

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    provider?: string;
  };
}

export async function listOpenRouterModels(config: OpenRouterConfig = defaultOpenRouterConfig) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    if (config.referer) {
      headers["HTTP-Referer"] = config.referer;
    }
    if (config.appName) {
      headers["X-Title"] = config.appName;
    }
    const res = await fetch(`${config.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, models: [] };
    const data = await res.json();
    const rawModels = (data.data || []).filter((m: any) => !m.architecture?.modality?.includes("image"));
    return {
      ok: true,
      models: (rawModels.length > 0 ? rawModels : (data.data || [])).map((m: OpenRouterModel) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length,
        provider: m.architecture?.provider || "unknown",
      })),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Connection refused", models: [] };
  }
}

export async function getOpenRouterConfig(): Promise<OpenRouterConfig> {
  try {
    const { db } = await import("@/db");
    const { appConfig } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(appConfig).where(eq(appConfig.key, "openrouter_base_url")).limit(1);
    const apiKeyRows = await db.select().from(appConfig).where(eq(appConfig.key, "openrouter_api_key")).limit(1);
    return {
      baseUrl: rows[0]?.value || defaultOpenRouterConfig.baseUrl,
      apiKey: apiKeyRows[0]?.value || defaultOpenRouterConfig.apiKey,
      timeoutMs: defaultOpenRouterConfig.timeoutMs,
      referer: defaultOpenRouterConfig.referer,
      appName: defaultOpenRouterConfig.appName,
    };
  } catch {
    return defaultOpenRouterConfig;
  }
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: string | { type: "function"; function: { name: string } };
}

export async function chatOpenRouter(req: OpenRouterChatRequest, config: OpenRouterConfig = defaultOpenRouterConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  if (config.referer) {
    headers["HTTP-Referer"] = config.referer;
  }
  if (config.appName) {
    headers["X-Title"] = config.appName;
  }
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...req, stream: false }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
