import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { HarnessSettings } from "@/lib/types";

const KEY = "harness";

export const DEFAULT_SETTINGS: HarnessSettings = {
  ollamaUrl: "http://localhost:11434",
  model: "llama3.1",
  temperature: 0.7,
  topP: 0.9,
  numCtx: 8192,
  numPredict: 2048,
  think: false,
  systemPrompt:
    "You are an assistant running inside a local agent harness backed by Ollama. " +
    "You have real tools available — call them whenever they help answer the request instead of guessing. " +
    "Be concise and factual. Prefer the most specific tool for a job, verify results when you modify files, " +
    "and report outcomes briefly. If a tool call fails, diagnose the error and adapt rather than repeating the exact same call. " +
    "Never invent tool results or file contents.",
  maxToolSteps: 6,
  contextMessages: 30,
  commandTimeoutMs: 25000,
  maxToolOutputChars: 12000,
  workspaceDir: "workspace",
  allowShell: true,
  plugins: { core: true, filesystem: true, shell: true, memory: true },
  activeSkills: [],
};

let cache: { ts: number; value: HarnessSettings } | null = null;

export async function getSettings(): Promise<HarnessSettings> {
  if (cache && Date.now() - cache.ts < 3000) return cache.value;
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, KEY))
      .limit(1);
    const value: HarnessSettings = {
      ...DEFAULT_SETTINGS,
      ...(rows[0]?.value ?? {}),
    };
    cache = { ts: Date.now(), value };
    return value;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  patch: Partial<HarnessSettings>
): Promise<HarnessSettings> {
  const current = await getSettings();
  const next: HarnessSettings = { ...current, ...patch };
  // sanitize
  next.ollamaUrl = (next.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl).replace(
    /\/+$/,
    ""
  );
  if (!/^https?:\/\//.test(next.ollamaUrl)) {
    next.ollamaUrl = "http://" + next.ollamaUrl;
  }
  next.maxToolSteps = clampInt(next.maxToolSteps, 1, 30);
  next.contextMessages = clampInt(next.contextMessages, 4, 200);
  next.commandTimeoutMs = clampInt(next.commandTimeoutMs, 1000, 300000);
  next.maxToolOutputChars = clampInt(next.maxToolOutputChars, 500, 200000);
  next.numCtx = clampInt(next.numCtx, 256, 262144);
  next.numPredict = clampInt(next.numPredict, -1, 32768);
  next.temperature = clampNum(next.temperature, 0, 2);
  next.topP = clampNum(next.topP, 0, 1);
  try {
    await db
      .insert(settings)
      .values({ key: KEY, value: next })
      .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  } catch {
    // table may not exist yet during bootstrap; keep in-memory
  }
  cache = { ts: Date.now(), value: next };
  return next;
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function clampNum(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
