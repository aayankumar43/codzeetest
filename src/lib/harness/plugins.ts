export interface PluginDef {
  id: string;
  name: string;
  description: string;
  tools: string[];
  systemNote: string;
}

export const PLUGINS: PluginDef[] = [
  {
    id: "core",
    name: "Core Utilities",
    description:
      "Time, a safe math evaluator, and an HTTP fetcher for reading docs, APIs and pages.",
    tools: ["time", "math", "http_get"],
    systemNote:
      "http_get fetches a URL and returns its body as text (use it to read documentation or inspect API responses). math evaluates arithmetic expressions. time returns the current date.",
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description:
      "Read, write and list files inside the harness workspace directory.",
    tools: ["read_file", "write_file", "list_dir"],
    systemNote:
      "File tools operate relative to the workspace directory (shown in the environment block). Always verify a file after writing it with read_file or list_dir.",
  },
  {
    id: "shell",
    name: "Shell",
    description:
      "Executes real shell commands on the host machine with a configurable timeout. Powerful — the model can build, test and inspect anything installed.",
    tools: ["bash"],
    systemNote:
      "The bash tool executes real shell commands on the host machine, starting in the workspace directory. Use it to run programs, inspect the system and verify results. Keep commands bounded and avoid destructive operations outside the workspace.",
  },
  {
    id: "memory",
    name: "Long-term Memory",
    description:
      "Persist key/value notes in the database that survive across conversations, plus full-text search over them.",
    tools: ["memory_store", "memory_search"],
    systemNote:
      "memory_store persists a key/value note across conversations; memory_search queries them. Search memory before assuming you lack a fact the user may have shared before, and store durable user preferences when learned.",
  },
];

export function pluginById(id: string): PluginDef | undefined {
  return PLUGINS.find((p) => p.id === id);
}
