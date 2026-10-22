import { exec } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import type { HarnessSettings } from "@/lib/types";
import { PLUGINS } from "./plugins";

export interface ToolContext {
  settings: HarnessSettings;
  workspace: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolDef extends ToolSpec {
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

/* ---------------------------------- math --------------------------------- */

function tokenizeMath(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      const num = expr.slice(i, j);
      if ((num.match(/\./g) || []).length > 1) throw new Error(`Bad number: ${num}`);
      tokens.push(num);
      i = j;
      continue;
    }
    if ("+-*/%^()".includes(c)) {
      tokens.push(c);
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
const RIGHT_ASSOC = new Set(["^", "-"]);

export function evaluateMath(expr: string): number {
  let tokens = tokenizeMath(expr);
  // handle unary minus
  const fixed: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t === "-" || t === "+") && (i === 0 || (tokens[i - 1] !== "num" && !/^\d/.test(tokens[i - 1]) && tokens[i - 1] !== ")"))) {
      if (t === "-") {
        fixed.push("(-");
      }
    } else {
      fixed.push(t);
    }
  }
  // balance: close parens around unary groups
  let depth = 0;
  const withParens: string[] = [];
  for (const t of fixed) {
    if (t === "(-") depth++;
    withParens.push(t);
  }
  for (let d = 0; d < depth; d++) withParens.push(")");
  tokens = withParens;

  // shunting-yard
  const out: (number | string)[] = [];
  const ops: string[] = [];
  for (const raw of tokens) {
    if (raw === "(-") {
      ops.push("u");
      continue;
    }
    const num = Number(raw);
    if (!Number.isNaN(num) && raw !== "") {
      out.push(num);
      continue;
    }
    if (raw === "(") {
      ops.push(raw);
      continue;
    }
    if (raw === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        const op = ops.pop() as string;
        out.push(op === "u" ? "u" : op);
      }
      if (!ops.length) throw new Error("Mismatched parentheses");
      ops.pop();
      continue;
    }
    const op = raw as string;
    while (ops.length) {
      const top = ops[ops.length - 1];
      if (top === "(") break;
      const topPrec = top === "u" ? 4 : PREC[top];
      const curPrec = PREC[op] ?? 0;
      if (topPrec > curPrec || (topPrec === curPrec && !RIGHT_ASSOC.has(op))) {
        out.push(ops.pop() as string);
      } else break;
    }
    ops.push(op);
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === "(") throw new Error("Mismatched parentheses");
    out.push(op);
  }

  const st: number[] = [];
  for (const t of out) {
    if (typeof t === "number") {
      st.push(t);
      continue;
    }
    if (t === "u") {
      const v = st.pop();
      if (v === undefined) throw new Error("Malformed expression");
      st.push(-v);
      continue;
    }
    if (st.length < 2) throw new Error("Malformed expression");
    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) throw new Error("Malformed expression");
    switch (t) {
      case "+":
        st.push(a + b);
        break;
      case "-":
        st.push(a - b);
        break;
      case "*":
        st.push(a * b);
        break;
      case "/":
        if (b === 0) throw new Error("Division by zero");
        st.push(a / b);
        break;
      case "%":
        if (b === 0) throw new Error("Modulo by zero");
        st.push(a % b);
        break;
      case "^":
        st.push(Math.pow(a, b));
        break;
      default:
        throw new Error(`Unknown operator: ${t}`);
    }
  }
  if (st.length !== 1) throw new Error("Malformed expression");
  const result = st[st.length - 1];
  if (result === undefined || !Number.isFinite(result)) throw new Error("Result is not finite");
  return result;
}

/* -------------------------------- workspace ------------------------------- */

export function resolveWorkspace(settings: HarnessSettings): string {
  const raw = settings.workspaceDir?.trim() || "workspace";
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(process.cwd(), raw);
  return abs;
}

export async function ensureWorkspaceSafely(workspace: string): Promise<void> {
  try {
    await fs.mkdir(workspace, { recursive: true });
  } catch {
    /* workspace may be read-only; tools will surface real errors */
  }
}

function resolveInWorkspace(p: string, workspace: string): string {
  const abs = path.isAbsolute(p) ? path.resolve(p) : path.resolve(workspace, p);
  const ws = path.resolve(workspace);
  if (abs !== ws && !abs.startsWith(ws + path.sep)) {
    throw new Error(`Path escapes the workspace: ${p}`);
  }
  return abs;
}

function truncate(output: string, max: number): { output: string; truncated: boolean } {
  if (output.length <= max) return { output, truncated: false };
  const rest = output.length - max;
  return {
    output: output.slice(0, max) + `\n…[truncated ${rest} more characters]`,
    truncated: true,
  };
}

/* --------------------------------- tools ---------------------------------- */

export const TOOLS: ToolDef[] = [
  {
    name: "time",
    description: "Returns the current date and time (UTC and local).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    run: async () => {
      const now = new Date();
      return {
        ok: true,
        output: `UTC: ${now.toISOString()}\nLocal: ${now.toString()}\nUnix ms: ${now.getTime()}`,
      };
    },
  },
  {
    name: "math",
    description:
      "Evaluates an arithmetic expression with + - * / % ^ (exponent) and parentheses. Returns the numeric result.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Arithmetic expression using + - * / % and ^ for exponent, e.g. (3+4)^2 or 10 % 3",
        },
      },
      required: ["expression"],
    },
    run: async (args) => {
      const expr = String(args.expression ?? "").trim();
      if (!expr) return { ok: false, output: "No expression provided" };
      const value = evaluateMath(expr);
      return {
        ok: true,
        output: `${expr} = ${Number.isInteger(value) ? value : Number(value.toPrecision(12))}`,
      };
    },
  },
  {
    name: "http_get",
    description:
      "Makes an HTTP GET request to a URL and returns status plus the response body as text (capped). Use for reading web pages, docs, and API responses.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL" },
        maxChars: { type: "number", description: "Optional cap on returned body characters" },
      },
      required: ["url"],
    },
    run: async (args, ctx) => {
      const url = String(args.url ?? "");
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return { ok: false, output: `Invalid URL: ${url}` };
      }
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, output: `Unsupported protocol: ${u.protocol}` };
      }
      const cap = Math.min(Number(args.maxChars) || ctx.settings.maxToolOutputChars, 200000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(u, {
          signal: controller.signal,
          redirect: "follow",
          headers: { "user-agent": "ollama-harness/1.0" },
        });
        const text = (await res.text()).slice(0, cap * 2);
        const lines = [
          `HTTP ${res.status} ${res.statusText}`,
          `content-type: ${res.headers.get("content-type") ?? "?"}`,
          `final url: ${res.url}`,
          "",
          text,
        ].join("\n");
        const { output, truncated } = truncate(lines, Math.max(cap, 1000));
        return { ok: res.ok, output: truncated ? output + "\n[body truncated]" : output };
      } catch (e) {
        return { ok: false, output: `Request failed: ${(e as Error).message}` };
      } finally {
        clearTimeout(timer);
      }
    },
  },
  {
    name: "read_file",
    description:
      "Reads a text file from the workspace directory (relative paths are resolved inside the workspace). Returns the content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the workspace" },
      },
      required: ["path"],
    },
    run: async (args, ctx) => {
      try {
        const abs = resolveInWorkspace(String(args.path ?? ""), ctx.workspace);
        const content = await fs.readFile(abs, "utf8");
        const { output, truncated } = truncate(content, ctx.settings.maxToolOutputChars);
        return { ok: true, output: truncated ? output + "\n[truncated]" : output };
      } catch (e) {
        return { ok: false, output: `read_file failed: ${(e as Error).message}` };
      }
    },
  },
  {
    name: "write_file",
    description:
      "Writes (creates or overwrites) a text file inside the workspace directory, creating parent folders as needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the workspace" },
        content: { type: "string", description: "Full file content to write" },
      },
      required: ["path", "content"],
    },
    run: async (args, ctx) => {
      try {
        const abs = resolveInWorkspace(String(args.path ?? ""), ctx.workspace);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, String(args.content ?? ""), "utf8");
        const stat = await fs.stat(abs);
        const rel = path.relative(ctx.workspace, abs);
        return { ok: true, output: `Wrote ${stat.size} bytes to ${rel}` };
      } catch (e) {
        return { ok: false, output: `write_file failed: ${(e as Error).message}` };
      }
    },
  },
  {
    name: "list_dir",
    description: "Lists files and directories inside the workspace, with sizes.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory relative to the workspace (default: root)", default: "." },
      },
      required: [],
    },
    run: async (args, ctx) => {
      try {
        const abs = resolveInWorkspace(String(args.path ?? "."), ctx.workspace);
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const rows: string[] = [];
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          try {
            const st = await fs.stat(path.join(abs, e.name));
            rows.push(
              e.isDirectory()
                ? `d  ${e.name}/`
                : `${String(st.size).padStart(9)}  ${e.name}`
            );
          } catch {
            rows.push(`?  ${e.name}`);
          }
        }
        return {
          ok: true,
          output: rows.length ? rows.join("\n") : "(empty directory)",
        };
      } catch (e) {
        return { ok: false, output: `list_dir failed: ${(e as Error).message}` };
      }
    },
  },
  {
    name: "bash",
    description:
      `Executes a shell command on the host machine starting in the workspace directory using the host shell (${process.platform === "win32" ? "PowerShell on Windows" : "bash on Unix"}). Returns combined stdout+stderr and exit code. On Windows, use PowerShell syntax and paths (for example: New-Item -ItemType File -Path \"$HOME/Desktop/Trip.txt\" -Force); on Unix, use bash syntax. Subject to a timeout.`,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command line to execute" },
        timeoutMs: {
          type: "number",
          description: "Optional timeout in milliseconds (defaults to the configured limit)",
        },
      },
      required: ["command"],
    },
    run: async (args, ctx) => {
      if (!ctx.settings.allowShell) {
        return { ok: false, output: "Shell execution is disabled in harness settings." };
      }
      const command = String(args.command ?? "");
      if (!command.trim()) return { ok: false, output: "No command provided" };
      const timeout = Math.min(
        Number(args.timeoutMs) || ctx.settings.commandTimeoutMs,
        ctx.settings.commandTimeoutMs
      );
      try {
        await ensureWorkspaceSafely(ctx.workspace);
        const absWs = ctx.workspace;
        const result = await new Promise<{ stdout: string; stderr: string; code: number }>(
          (resolve) => {
            exec(
              command,
              {
                cwd: absWs,
                timeout,
                maxBuffer: 4 * 1024 * 1024,
                env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
                shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
              },
              (error, stdout, stderr) => {
                const code =
                  error && typeof (error as { code?: number }).code === "number"
                    ? ((error as { code?: number }).code as number)
                    : error
                      ? 1
                      : 0;
                resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code });
              }
            );
          }
        );
        const timedOut = result.stderr.includes("Command failed with timeout");
        const parts = [
          `exit code: ${result.code}${timedOut ? " (timeout)" : ""}`,
          result.stdout ? `stdout:\n${result.stdout.trimEnd()}` : "",
          result.stderr ? `stderr:\n${result.stderr.trimEnd()}` : "",
        ].filter(Boolean);
        const { output, truncated } = truncate(parts.join("\n\n") || "(no output)", ctx.settings.maxToolOutputChars);
        return { ok: result.code === 0, output: truncated ? output + "\n[truncated]" : output };
      } catch (e) {
        return { ok: false, output: `bash failed: ${(e as Error).message}` };
      }
    },
  },
  {
    name: "memory_store",
    description:
      "Persists a key/value note in long-term memory (database). Survives across conversations. Overwrites existing key.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short unique key, e.g. 'user-name', 'project-api-base'" },
        value: { type: "string", description: "The note to remember" },
      },
      required: ["key", "value"],
    },
    run: async (args) => {
      const key = String(args.key ?? "").trim();
      const value = String(args.value ?? "");
      if (!key) return { ok: false, output: "Memory key is required" };
      try {
        await db
          .insert(memories)
          .values({ id: crypto.randomUUID(), key, value })
          .onConflictDoUpdate({ target: memories.key, set: { value, updatedAt: new Date() } });
        return { ok: true, output: `Stored memory '${key}' (${value.length} chars)` };
      } catch (e) {
        return { ok: false, output: `memory_store failed: ${(e as Error).message}` };
      }
    },
  },
  {
    name: "memory_search",
    description:
      "Searches long-term memory notes (key and value) for a query. Returns up to 10 matching notes.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text" },
      },
      required: ["query"],
    },
    run: async (args) => {
      const q = String(args.query ?? "").trim().replace(/[%_]/g, " ");
      if (!q) return { ok: false, output: "Query is required" };
      try {
        const rows = await db
          .select()
          .from(memories)
          .where(sql`(${memories.key} ILIKE '%' || ${q} || '%' OR ${memories.value} ILIKE '%' || ${q} || '%')`)
          .orderBy(memories.updatedAt)
          .limit(10);
        if (!rows.length) return { ok: true, output: "No matching memories." };
        return {
          ok: true,
          output: rows
            .map((r) => `- ${r.key}: ${r.value}  (updated ${r.updatedAt.toISOString()})`)
            .join("\n"),
        };
      } catch (e) {
        return { ok: false, output: `memory_search failed: ${(e as Error).message}` };
      }
    },
  },
];

export const TOOL_MAP: Map<string, ToolDef> = new Map(TOOLS.map((t) => [t.name, t]));

export function allTools(): ToolDef[] {
  return TOOLS;
}

export function toolsForPlugins(plugins: Record<string, boolean>): ToolDef[] {
  const names = new Set<string>();
  for (const p of PLUGINS) {
    if (plugins[p.id]) p.tools.forEach((t) => names.add(t));
  }
  return TOOLS.filter((t) => names.has(t.name));
}

export function activeTools(settings: HarnessSettings): ToolDef[] {
  const tools = toolsForPlugins(settings.plugins);
  if (!settings.allowShell) return tools.filter((t) => t.name !== "bash");
  return tools;
}

export function availableToolNames(settings: HarnessSettings): Set<string> {
  return new Set(activeTools(settings).map((t) => t.name));
}

export function hostInfo(): string {
  return `os: ${os.platform()} ${os.release()} | arch: ${os.arch()} | cpus: ${os.cpus().length} | shell cwd: workspace`;
}
