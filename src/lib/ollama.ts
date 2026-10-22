export interface OllamaConfig {
  baseUrl: string;
  timeoutMs: number;
}

export async function getOllamaConfig(): Promise<OllamaConfig> {
  try {
    const { db } = await import("@/db");
    const { appConfig } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(appConfig).where(eq(appConfig.key, "ollama_host")).limit(1);
    if (rows[0]?.value) {
      return { baseUrl: rows[0].value, timeoutMs: 30000 };
    }
  } catch {}
  return { baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434", timeoutMs: 30000 };
}

export const defaultConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
  timeoutMs: 30000,
};

export async function listOllamaModels(config: OllamaConfig = defaultConfig) {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, models: [] };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map((m: any) => ({
      name: m.name,
      tag: m.tag || m.name,
      size: m.size,
      digest: m.digest,
    })) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Connection refused", models: [] };
  }
}

export async function pullOllamaModel(name: string, config: OllamaConfig = defaultConfig) {
  return fetch(`${config.baseUrl}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteOllamaModel(name: string, config: OllamaConfig = defaultConfig) {
  return fetch(`${config.baseUrl}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: { temperature?: number; top_p?: number; seed?: number };
  tools?: any[];
}

export async function chatOllama(req: ChatRequest, config: OllamaConfig = defaultConfig) {
  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: false }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  return res.json();
}

export async function generateOllama(req: { model: string; prompt: string; stream?: boolean; options?: any }, config: OllamaConfig = defaultConfig) {
  const res = await fetch(`${config.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: false }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  return res.json();
}
