import { db } from "@/db";
import { settings, skills } from "./schema";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS } from "@/lib/harness/config";

interface BuiltinSkill {
  name: string;
  description: string;
  body: string;
  tools: string[];
}

const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    name: "web-researcher",
    description: "Fetch and distill information from web pages and JSON APIs.",
    body: `When asked to look something up online:
1. Use http_get on the most authoritative URL you can identify (official docs first, then project sites).
2. If a page is HTML and huge, ask for a smaller endpoint or a specific section; extract only what matters.
3. For JSON APIs, quote the exact fields that answer the question.
4. Cite each source inline as (source: URL).
5. If a fetch fails, try one alternate URL before giving up, and say what you tried.
Never present a guess as fetched data — if you could not fetch it, say so.`,
    tools: ["http_get"],
  },
  {
    name: "shell-operator",
    description: "Safely run and verify shell commands on the host machine.",
    body: `Rules for using the bash tool:
- Start with the cheapest verification: \`ls\`, \`--version\`, \`which X\` before assuming something is installed.
- Prefer non-interactive flags; never run commands that wait on a TTY.
- Keep destructive operations inside the workspace directory. Never format, move or delete outside it.
- Pipe long output through \`head -n 40\` or grep for the relevant part.
- After any mutation (build, install, write), run a verification command and report its real output.
- If a command times out, reduce scope (add --quiet, narrow the path) instead of retrying blindly.`,
    tools: ["bash"],
  },
  {
    name: "file-engineer",
    description: "Create, edit and verify files inside the workspace.",
    body: `File conventions:
- Create files with write_file using relative workspace paths (e.g. reports/summary.md).
- For code files, keep them complete and runnable — never emit placeholders like "TODO: rest of code".
- After writing, verify with read_file (small files) or list_dir (structure) and report size/line count.
- When editing an existing file, read_file first, then write_file the full new content.
- Organize output under a task-named folder when there are more than two files.`,
    tools: ["read_file", "write_file", "list_dir"],
  },
  {
    name: "data-cruncher",
    description: "Process CSV/JSON/text data with shell one-liners and math.",
    body: `Data processing playbook:
1. Inspect first: \`head -n 5 file.csv\` and \`wc -l file.csv\` via bash.
2. Use awk/sort/uniq/jq (if available) for aggregation; keep commands in a single pipeline where possible.
3. Cross-check totals with the math tool on small aggregates.
4. Save results with write_file as CSV or JSON, and show a short sample of the output.
5. Report row counts in/out so the user can see nothing was silently dropped.
If a required binary (jq, python3) is missing, check with \`command -v\` and fall back to awk.`,
    tools: ["bash", "read_file", "write_file", "math"],
  },
  {
    name: "markdown-writer",
    description: "Produce clean, scannable markdown documents.",
    body: `Writing style:
- Lead with the answer, then supporting detail. No preamble like "Sure, here is...".
- Use tables for comparisons, fenced code blocks with language tags for code.
- Keep sections under ~120 words; use ### headers, not # headers, inside documents.
- Prefer bullet lists of 2–5 items; every bullet starts with a verb or a noun phrase, no filler.
- End with a "Next steps" list only when there is a real action for the user.
Save documents with write_file under docs/ unless the user names a path.`,
    tools: ["write_file"],
  },
  {
    name: "ollama-admin",
    description: "Inspect and manage local Ollama models via its HTTP API.",
    body: `Ollama HTTP API quick reference (server URL is in the environment block):
- GET  /api/version            → { "version": "..." }
- GET  /api/tags               → installed models with size + details
- GET  /api/ps                 → models currently loaded in memory
- POST /api/chat               → { model, messages, stream, tools, options }
- POST /api/generate           → one-shot prompt completion
- POST /api/pull { "name": "..." }        → download a model (streamed progress)
- POST /api/create { "name": "...", "from": "..." } → build a model from another
- POST /api/delete { "name": "..." }      → remove a model
Use http_get for the GET endpoints (JSON comes back as text). For pull/delete, prefer the Models view in the UI, or via bash:
  curl -s -X POST http://localhost:11434/api/delete -d '{"name":"<model>"}'
Replace the URL with the server from the environment block. Report model sizes and whether a model is loaded before suggesting switches.`,
    tools: ["http_get", "bash"],
  },
];

let seeding = false;

export async function ensureSeed(): Promise<void> {
  if (seeding) return;
  seeding = true;
  try {
    const count = await db.select({ c: sql<number>`count(*)` }).from(settings);
    if (Number(count[0]?.c ?? 0) === 0) {
      await db
        .insert(settings)
        .values({ key: "harness", value: { ...DEFAULT_SETTINGS } })
        .onConflictDoNothing();
    }
    const skCount = await db.select({ c: sql<number>`count(*)` }).from(skills);
    if (Number(skCount[0]?.c ?? 0) === 0) {
      for (const sk of BUILTIN_SKILLS) {
        await db
          .insert(skills)
          .values({
            id: crypto.randomUUID(),
            name: sk.name,
            description: sk.description,
            body: sk.body,
            tools: sk.tools,
            enabled: true,
            builtin: true,
          })
          .onConflictDoNothing();
      }
    }
  } catch (e) {
    // tables may not exist yet right after bootstrap; retry next call
    lastSeedError = (e as Error).message;
    console.warn("ensureSeed skipped:", (e as Error).message);
  } finally {
    seeding = false;
  }
}

export let lastSeedError: string | null = null;

export { BUILTIN_SKILLS };
