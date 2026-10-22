"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2, Plug, Server, AlertCircle, CheckCircle2, X, Copy, ArrowRight } from "lucide-react";

const MCP_PRESETS = [
  {
    name: "Filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
    env: {},
    transport: "stdio",
    description: "Access local file system — read, write, list, edit files",
    icon: "",
  },
  {
    name: "GitHub",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    transport: "stdio",
    description: "Interact with GitHub repos, PRs, issues, code search",
    icon: "",
  },
  {
    name: "PostgreSQL",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/mydb"],
    env: {},
    transport: "stdio",
    description: "Query and manage PostgreSQL databases",
    icon: "🗄️",
  },
  {
    name: "Slack",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: { SLACK_BOT_TOKEN: "", SLACK_TEAM_ID: "" },
    transport: "stdio",
    description: "Read/write Slack messages and channels",
    icon: "💬",
  },
  {
    name: "Puppeteer",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    env: {},
    transport: "stdio",
    description: "Browser automation and web scraping",
    icon: "🌐",
  },
  {
    name: "Brave Search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: "" },
    transport: "stdio",
    description: "Web search via Brave Search API",
    icon: "🔍",
  },
  {
    name: "Google Drive",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    env: { GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
    transport: "stdio",
    description: "Access files and documents in Google Drive",
    icon: "☁️",
  },
  {
    name: "SSE Remote",
    command: "",
    args: [],
    env: {},
    transport: "sse",
    url: "http://localhost:3001/mcp",
    description: "Connect to a remote MCP server via SSE transport",
    icon: "🔗",
  },
];

export default function MCPPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    command: "npx",
    args: [] as string[],
    env: [] as { key: string; value: string }[],
    transport: "stdio" as "stdio" | "sse",
    url: "",
  });
  const [tools, setTools] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [newArg, setNewArg] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [connectStatus, setConnectStatus] = useState<Record<number, "idle" | "connecting" | "connected" | "error">>({});
  const [error, setError] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const fetchAll = async () => { setLoading(true); const d = await fetch("/api/mcp").then(r => r.json()); setServers(d.servers || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);

  const addArg = () => {
    if (newArg.trim()) {
      setForm(f => ({ ...f, args: [...f.args, newArg.trim()] }));
      setNewArg("");
    }
  };
  const removeArg = (i: number) => setForm(f => ({ ...f, args: f.args.filter((_, idx) => idx !== i) }));

  const addEnv = () => {
    if (newEnvKey.trim()) {
      setForm(f => ({ ...f, env: [...f.env, { key: newEnvKey.trim(), value: newEnvValue }] }));
      setNewEnvKey("");
      setNewEnvValue("");
    }
  };
  const removeEnv = (i: number) => setForm(f => ({ ...f, env: f.env.filter((_, idx) => idx !== i) }));

  const usePreset = (p: typeof MCP_PRESETS[number]) => {
    setForm({
      name: p.name,
      command: p.command,
      args: [...p.args],
      env: Object.entries(p.env).map(([k, v]) => ({ key: k, value: v })),
      transport: p.transport as "stdio" | "sse",
      url: (p as any).url || "",
    });
    setShowPresets(false);
    setError("");
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) { setError("NAME_REQUIRED"); return false; }
    if (form.transport === "stdio" && !form.command.trim()) { setError("COMMAND_REQUIRED_FOR_STDIO"); return false; }
    if (form.transport === "sse" && !form.url.trim()) { setError("URL_REQUIRED_FOR_SSE"); return false; }
    return true;
  };

  const add = async () => {
    setError("");
    if (!validateForm()) return;

    const envObj: Record<string, string> = {};
    form.env.forEach(e => { if (e.key) envObj[e.key] = e.value; });

    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: form.name,
          command: form.command,
          args: form.args,
          env: envObj,
          transport: form.transport,
          url: form.transport === "sse" ? form.url : null,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setForm({ name: "", command: "npx", args: [], env: [], transport: "stdio", url: "" });
        fetchAll();
      } else {
        setError(d.error || "REGISTER_FAILED");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const connect = async (id: number) => {
    setConnectStatus(s => ({ ...s, [id]: "connecting" }));
    try {
      const d = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", id }),
      }).then(r => r.json());
      setConnectStatus(s => ({ ...s, [id]: d.ok ? "connected" : "error" }));
      setTimeout(() => setConnectStatus(s => ({ ...s, [id]: "idle" })), 3000);
    } catch {
      setConnectStatus(s => ({ ...s, [id]: "error" }));
    }
    fetchAll();
  };

  const listTools = async (id: number) => {
    setSelected(id);
    const d = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list-tools", id }) }).then(r => r.json());
    setTools(d.tools || []);
  };

  const remove = async (id: number) => { await fetch("/api/mcp", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); fetchAll(); };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="hud-alert-box text-sm mb-2">MCP_SERVERS</div>
          <p className="text-xs text-hud-text-dim tracking-wide">Connect Model Context Protocol servers for extended tool discovery</p>
        </div>
        <button onClick={fetchAll} className="hud-btn px-3 py-2 flex items-center gap-2 text-xs">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
        </button>
      </div>

      {/* Presets Section */}
      <div className="hud-panel hud-bracket p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="hud-data-label">QUICK_PRESETS // ONE_CLICK_SETUP</div>
          <button onClick={() => setShowPresets(!showPresets)} className="hud-btn px-3 py-1 text-[10px] flex items-center gap-1">
            {showPresets ? "HIDE_PRESETS" : "SHOW_PRESETS"}
          </button>
        </div>

        {showPresets && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            {MCP_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => usePreset(p)}
                className="hud-btn text-left p-3 flex flex-col gap-1 group"
              >
                <div className="text-lg">{p.icon}</div>
                <div className="text-xs font-bold tracking-wider text-hud-text group-hover:text-hud-cyan">{p.name}</div>
                <div className="text-[10px] text-hud-text-dim leading-tight">{p.description}</div>
                <div className="mt-1 text-[9px] font-mono text-hud-text-dim">{p.transport.toUpperCase()} {p.transport === "sse" ? `· ${p.url}` : ""}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Registration Form */}
      <div className="hud-panel hud-bracket p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="hud-data-label">REGISTER_MCP_SERVER</div>
          {error && (
            <div className="flex items-center gap-1 text-[10px] text-hud-red">
              <AlertCircle className="w-3 h-3" /> {error}
            </div>
          )}
        </div>

        {/* Identity Section */}
        <div>
          <div className="hud-data-label mb-2">IDENTITY</div>
          <div className="grid md:grid-cols-2 gap-2">
            <input className="hud-input px-3 py-2" placeholder="SERVER_NAME (required)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="hud-input px-3 py-2" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value as "stdio" | "sse" })}>
              <option value="stdio">STDIO_TRANSPORT</option>
              <option value="sse">SSE_TRANSPORT</option>
            </select>
          </div>
          {form.transport === "sse" && (
            <input className="hud-input w-full mt-2 px-3 py-2" placeholder="SSE_ENDPOINT_URL (required for SSE)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          )}
        </div>

        {/* Command & Args */}
        {form.transport === "stdio" && (
          <div>
            <div className="hud-data-label mb-2">COMMAND_EXEC</div>
            <input className="hud-input w-full px-3 py-2" placeholder="COMMAND (e.g. npx, node, python)" value={form.command} onChange={e => setForm({ ...form, command: e.target.value })} />

            <div className="mt-3">
              <div className="hud-data-label mb-2">ARGS ({form.args.length})</div>
              <div className="flex flex-wrap gap-1 p-2 border border-hud-border bg-hud-bg min-h-[40px] max-h-32 overflow-y-auto">
                {form.args.length === 0 ? <span className="text-[10px] text-hud-text-dim self-center">NO_ARGS_DEFINED</span> :
                  form.args.map((a, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-hud-cyan-dim text-hud-cyan border border-hud-cyan/40 flex items-center gap-1">
                      <span>{a}</span>
                      <button onClick={() => removeArg(i)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))
                }
              </div>
              <div className="flex gap-2 mt-2">
                <input className="hud-input flex-1 px-3 py-2 text-xs" placeholder="ADD_ARG_VALUE" value={newArg} onChange={e => setNewArg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addArg(); } }} />
                <button onClick={addArg} className="hud-btn px-3 py-2 text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> ADD
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Environment Variables */}
        <div>
          <div className="hud-data-label mb-2">ENV_VARS ({form.env.length})</div>
          {form.env.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto border border-hud-border bg-hud-bg p-2">
              {form.env.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-hud-cyan w-1/3 truncate">{e.key}</span>
                  <ArrowRight className="w-3 h-3 text-hud-text-dim shrink-0" />
                  <span className="text-hud-text flex-1 truncate">{e.value ? "••••••••" : <span className="text-hud-text-dim">EMPTY</span>}</span>
                  <button onClick={() => removeEnv(i)} className="hud-btn-danger px-1 py-0.5"><X className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-hud-border bg-hud-bg p-3 text-[10px] text-hud-text-dim text-center">NO_ENV_VARS_DEFINED</div>
          )}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mt-2">
            <input className="hud-input px-3 py-2 text-xs" placeholder="ENV_KEY" value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newEnvValue) addEnv(); else addEnv(); } }} />
            <input className="hud-input px-3 py-2 text-xs" placeholder="ENV_VALUE" type="password" value={newEnvValue} onChange={e => setNewEnvValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEnv(); } }} />
            <button onClick={addEnv} className="hud-btn px-3 py-2 text-xs flex items-center gap-1">
              <Plus className="w-3 h-3" /> ADD
            </button>
          </div>
        </div>

        {/* Summary & Register */}
        <div className="pt-3 border-t border-hud-border">
          <div className="hud-data-label mb-2">REGISTRATION_SUMMARY</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
            <div>
              <div className="text-hud-text-dim">NAME</div>
              <div className="text-hud-text truncate">{form.name || "—"}</div>
            </div>
            <div>
              <div className="text-hud-text-dim">TRANSPORT</div>
              <div className="text-hud-text">{form.transport.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-hud-text-dim">ARGS</div>
              <div className="text-hud-text">{form.args.length}</div>
            </div>
            <div>
              <div className="text-hud-text-dim">ENV_VARS</div>
              <div className="text-hud-text">{form.env.length}</div>
            </div>
          </div>
          <button onClick={add} className="hud-btn-primary w-full mt-4 py-2.5 text-xs">
            REGISTER_SERVER
          </button>
        </div>
      </div>

      {/* Server Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers.map((s: any) => {
          const status = connectStatus[s.id] || "idle";
          return (
            <div key={s.id} className="hud-card hud-bracket">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="hud-data-label">SERVER_ID :: {s.id.toString().padStart(3, "0")}</div>
                  <div className="text-sm font-bold tracking-wider mt-1">{s.name}</div>
                  <div className="text-[10px] text-hud-text-dim mt-1 font-mono">
                    {s.command || "SSE"} // {s.transport.toUpperCase()}
                    {s.url && <div className="text-hud-cyan break-all">{s.url}</div>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                  s.status === "connected"
                    ? "bg-hud-green-dim text-hud-green border-hud-green/40"
                    : s.status === "error"
                    ? "bg-hud-red-dim text-hud-red border-hud-red/40"
                    : "border-hud-border text-hud-text-dim"
                }`}>
                  {s.status?.toUpperCase() || "IDLE"}
                </span>
              </div>

              {/* Detail row */}
              <div className="text-[10px] font-mono text-hud-text-dim space-y-0.5">
                <div>ARGS: <span className="text-hud-text">{Array.isArray(s.args) ? s.args.length : 0}</span> · ENV: <span className="text-hud-text">{Object.keys(s.env || {}).length}</span></div>
                <div>ADDED: <span className="text-hud-text">{new Date(s.createdAt).toLocaleDateString()}</span></div>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => connect(s.id)} className="hud-btn flex-1 px-3 py-1.5 flex items-center justify-center gap-1">
                  {status === "connecting" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                  {status === "connecting" ? "..." : status === "connected" ? "RE-CONNECT" : "CONNECT"}
                </button>
                <button onClick={() => listTools(s.id)} className="hud-btn px-3 py-1.5">
                  TOOLS
                </button>
                <button onClick={() => remove(s.id)} className="hud-btn-danger px-2 py-1.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tools Panel */}
      {selected && (
        <div className="hud-panel hud-bracket p-5">
          <div className="flex items-center justify-between">
            <div className="hud-data-label">MCP_TOOLS_DISCOVERED // SERVER_ID: {selected}</div>
            <button onClick={() => setSelected(null)} className="hud-btn px-2 py-1 text-[10px]"><X className="w-3 h-3" /></button>
          </div>
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {tools.length === 0 ? <div className="text-xs text-hud-text-dim col-span-2 text-center py-6 border border-dashed border-hud-border">NO_TOOLS_DISCOVERED // ENSURE_SERVER_CONNECTED</div> : tools.map((t: any) => (
              <div key={t.name} className="border border-hud-border p-3 bg-hud-bg hover:border-hud-cyan/30 transition">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold tracking-wider text-hud-cyan">{t.name}</div>
                  <span className="text-[9px] text-hud-text-dim font-mono">FN</span>
                </div>
                <div className="text-[11px] text-hud-text-soft mt-1">{t.description || "No description provided."}</div>
                <div className="text-[10px] font-mono text-hud-text-dim mt-2 pt-2 border-t border-hud-border/50 break-all">
                  {JSON.stringify(t.inputSchema).slice(0, 160)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {servers.length === 0 && !loading && (
        <div className="hud-panel hud-bracket p-8 text-center">
          <div className="text-sm text-hud-text tracking-widest">NO_MCP_SERVERS_REGISTERED</div>
          <div className="text-[10px] text-hud-text-dim mt-2">Use the presets above or fill the form to add your first MCP server</div>
        </div>
      )}
    </div>
  );
}
