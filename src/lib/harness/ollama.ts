import type { HarnessSettings, LoadedModelInfo, ModelInfo } from "@/lib/types";

export class OllamaError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaChatStats {
  totalDurationMs: number;
  promptEvalCount: number;
  evalCount: number;
}

interface ChatChunk {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

function base(s: HarnessSettings): string {
  return (s.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
}

async function readJson(res: Response, what: string): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new OllamaError(
      `${what} returned HTTP ${res.status}: ${text.slice(0, 300) || "no body"}`,
      res.status
    );
  }
}

export async function ollamaStatus(s: HarnessSettings): Promise<{
  reachable: boolean;
  version?: string;
  error?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${base(s)}/api/version`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await readJson(res, "version")) as { version?: string };
    return { reachable: true, version: data.version };
  } catch (e) {
    const msg =
      (e as Error).name === "AbortError"
        ? `Timed out connecting to ${base(s)}`
        : `Cannot reach Ollama at ${base(s)} — is it running? Start it with: ollama serve`;
    return { reachable: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function listModels(s: HarnessSettings): Promise<ModelInfo[]> {
  const res = await fetch(`${base(s)}/api/tags`);
  if (!res.ok) throw new OllamaError(`GET /api/tags → HTTP ${res.status}`, res.status);
  const data = (await readJson(res, "tags")) as { models?: ModelInfo[] };
  return data.models ?? [];
}

export async function loadedModels(s: HarnessSettings): Promise<LoadedModelInfo[]> {
  const res = await fetch(`${base(s)}/api/ps`);
  if (!res.ok) throw new OllamaError(`GET /api/ps → HTTP ${res.status}`, res.status);
  const data = (await readJson(res, "ps")) as { models?: LoadedModelInfo[] };
  return data.models ?? [];
}

export async function deleteModel(s: HarnessSettings, name: string): Promise<void> {
  const res = await fetch(`${base(s)}/api/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = (await readJson(res, "delete")) as { error?: string };
    throw new OllamaError(data.error ?? `DELETE → HTTP ${res.status}`, res.status);
  }
}

export async function pullModel(
  s: HarnessSettings,
  name: string,
  onProgress: (p: {
    status: string;
    digest?: string;
    completed?: number;
    total?: number;
  }) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${base(s)}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = (await readJson(res, "pull")) as { error?: string };
    throw new OllamaError(data.error ?? `PULL → HTTP ${res.status}`, res.status);
  }
  await streamNdjson(res, (line) => {
    try {
      const p = JSON.parse(line) as { status?: string; digest?: string; completed?: number; total?: number; error?: string };
      if (p.error) throw new OllamaError(p.error);
      onProgress({
        status: p.status ?? "pulling",
        digest: p.digest,
        completed: p.completed,
        total: p.total,
      });
    } catch (e) {
      if (e instanceof OllamaError) throw e;
    }
  });
}

/**
 * Streams /api/chat and returns the final assistant message plus stats.
 * Calls onDelta for every content chunk.
 */
export async function chatStream(
  s: HarnessSettings,
  payload: {
    model: string;
    messages: OllamaMessage[];
    tools?: unknown[];
    think?: boolean;
  },
  signal: AbortSignal,
  onDelta: (content: string) => void
): Promise<{ message: OllamaMessage; stats: OllamaChatStats }> {
  const body: Record<string, unknown> = {
    model: payload.model,
    messages: payload.messages,
    stream: true,
    options: {
      temperature: s.temperature,
      top_p: s.topP,
      num_ctx: s.numCtx,
      num_predict: s.numPredict,
    },
  };
  if (payload.think) body.think = true;
  if (payload.tools && payload.tools.length) body.tools = payload.tools;

  const res = await fetch(`${base(s)}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Ollama chat → HTTP ${res.status}`;
    try {
      const data = (await readJson(res, "chat")) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* keep default */
    }
    throw new OllamaError(msg, res.status);
  }

  let finalMessage: OllamaMessage = { role: "assistant", content: "" };
  let content = "";
  let stats: OllamaChatStats = { totalDurationMs: 0, promptEvalCount: 0, evalCount: 0 };
  let sawDone = false;

  await streamNdjson(res, (line) => {
    const chunk = JSON.parse(line) as ChatChunk;
    if (chunk.error) throw new OllamaError(chunk.error);
    if (chunk.message) {
      const delta = chunk.message.content ?? "";
      if (delta) {
        content += delta;
        onDelta(delta);
      }
      finalMessage = {
        role: (chunk.message.role as OllamaMessage["role"]) ?? "assistant",
        content,
        tool_calls: chunk.message.tool_calls ?? finalMessage.tool_calls,
      };
    }
    if (chunk.done) {
      sawDone = true;
      stats = {
        totalDurationMs: (chunk.total_duration ?? 0) / 1e6,
        promptEvalCount: chunk.prompt_eval_count ?? 0,
        evalCount: chunk.eval_count ?? 0,
      };
    }
  });

  if (!sawDone && !finalMessage.content && !finalMessage.tool_calls?.length) {
    throw new OllamaError("Ollama stream ended without a done event");
  }
  return { message: finalMessage, stats };
}

async function streamNdjson(
  res: Response,
  onLine: (line: string) => void
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) onLine(line);
      }
    }
    const tail = buffer.trim();
    if (tail) onLine(tail);
  } finally {
    reader.releaseLock();
  }
}
