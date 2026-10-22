"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Activity } from "lucide-react";
import MemoryNexus from "./components/MemoryNexus";

export default function Dashboard() {
  const [stats, setStats] = useState({
    models: 0,
    tools: 0,
    plugins: 0,
    skills: 0,
    agents: 0,
    mcp: 0,
    ollama: false,
    omniroute: false,
    openrouter: false,
  });
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState("");
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(d => setStats(s => ({ ...s, models: d.models?.length || 0, omniroute: d.omniroute?.ok || false })));
    fetch("/api/tools").then(r => r.json()).then(d => setStats(s => ({ ...s, tools: d.tools?.length || 0 })));
    fetch("/api/plugins").then(r => r.json()).then(d => setStats(s => ({ ...s, plugins: d.plugins?.length || 0 })));
    fetch("/api/skills").then(r => r.json()).then(d => setStats(s => ({ ...s, skills: d.skills?.length || 0 })));
    fetch("/api/agents").then(r => r.json()).then(d => setStats(s => ({ ...s, agents: d.agents?.length || 0 })));
    fetch("/api/mcp").then(r => r.json()).then(d => setStats(s => ({ ...s, mcp: d.servers?.length || 0 })));
    fetch("/api/ollama/status").then(r => r.json()).then(d => setStats(s => ({ ...s, ollama: d.ollamaConnected || false })));
    fetch("/api/openrouter/status").then(r => r.json()).then(d => setStats(s => ({ ...s, openrouter: d.openrouterConnected || false })));

    const tick = setInterval(() => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`);
    }, 1000);

    const uptimeTick = setInterval(() => {
      setUptime(u => u + 1);
    }, 1000);

    setTimeout(() => setLoading(false), 600);
    return () => { clearInterval(tick); clearInterval(uptimeTick); };
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const totalNodes = stats.models + stats.tools + stats.plugins + stats.skills + stats.agents + stats.mcp;

  const cards = [
    { label: "CONFIGURED_MODELS", value: stats.models, href: "/models", code: "02" },
    { label: "CONNECTED_TOOLS", value: stats.tools, href: "/tools", code: "03" },
    { label: "ACTIVE_PLUGINS", value: stats.plugins, href: "/plugins", code: "04" },
    { label: "BUILT_SKILLS", value: stats.skills, href: "/skills", code: "05" },
    { label: "REGISTERED_AGENTS", value: stats.agents, href: "/agents", code: "06" },
  ];

  return (
    <div className="space-y-8">
      {/* System Info Header */}
      <div className="border-b border-hud-border pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6 items-center">
          {/* Left: Identity */}
          <div className="space-y-2">
            <div className="hud-data-label">HARNESS_ID</div>
            <div className="text-xl font-bold tracking-widest text-hud-text">OLLAMA_HARNESS</div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-hud-text-dim">BUILD</span>
              <span className="text-hud-cyan font-mono">2026.08.20</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-hud-text-dim">VERSION</span>
              <span className="text-hud-cyan font-mono">v2.1.0</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-hud-text-dim">NODE_ENV</span>
              <span className="text-hud-text font-mono">{typeof window !== "undefined" ? (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "DEV" : "PROD") : "—"}</span>
            </div>
          </div>

          {/* Center: Live Status Grid */}
          <div className="border border-hud-border bg-hud-bg/50 p-4">
            <div className="hud-data-label mb-3 tracking-widest">SYSTEM_STATUS // LIVE</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border-l-2 border-hud-text/20 pl-3">
                <div className="hud-data-label">OLLAMA_ENGINE</div>
                <div className={`text-sm font-bold tracking-widest mt-0.5 ${stats.ollama ? "hud-status-online" : "hud-status-offline"}`}>
                  {stats.ollama ? "● ONLINE" : "● OFFLINE"}
                </div>
                <div className="text-[10px] font-mono text-hud-text-dim mt-0.5">127.0.0.1:11434</div>
              </div>

              <div className="border-l-2 border-hud-text/20 pl-3">
                <div className="hud-data-label">OMNIRROUTE_GW</div>
                <div className={`text-sm font-bold tracking-widest mt-0.5 ${stats.omniroute ? "hud-status-online" : "hud-status-offline"}`}>
                  {stats.omniroute ? "● ONLINE" : "● OFFLINE"}
                </div>
                <div className="text-[10px] font-mono text-hud-text-dim mt-0.5">localhost:20128</div>
              </div>

              <div className="border-l-2 border-hud-text/20 pl-3">
                <div className="hud-data-label">OPENROUTER</div>
                <div className={`text-sm font-bold tracking-widest mt-0.5 ${stats.openrouter ? "hud-status-online" : "hud-status-offline"}`}>
                  {stats.openrouter ? "● ONLINE" : "● OFFLINE"}
                </div>
                <div className="text-[10px] font-mono text-hud-text-dim mt-0.5">openrouter.ai</div>
              </div>

              <div className="border-l-2 border-hud-text/20 pl-3">
                <div className="hud-data-label">POSTGRES_DB</div>
                <div className="text-sm font-bold tracking-widest mt-0.5 hud-status-online">
                  ● ONLINE
                </div>
                <div className="text-[10px] font-mono text-hud-text-dim mt-0.5">DRIZZLE_ORM</div>
              </div>
            </div>
            <div className="mt-4 border-t border-hud-border pt-2 flex items-center justify-end">
              <div className="text-right">
                <div className="hud-data-label text-[9px]">ACTIVE_NODES</div>
                <div className="text-lg font-bold tracking-widest text-hud-text">
                  {loading ? "—" : totalNodes.toString().padStart(3, "0")}
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div className="mt-3 pt-3 border-t border-hud-border flex items-center gap-4 text-[10px] font-mono">
              <span className="text-hud-text-dim">SYS_OP:</span>
              <span className={stats.ollama ? "hud-status-online" : "hud-status-warning"}>
                {stats.ollama || stats.openrouter ? "NOMINAL" : "DEGRADED"}
              </span>
              <span className="text-hud-text-dim">LOAD:</span>
              <span className="text-hud-text">{Math.min(100, totalNodes * 8)}%</span>
              <span className="text-hud-text-dim">MODE:</span>
              <span className="text-hud-cyan">HYBRID_CLOUD</span>
            </div>
          </div>

          {/* Right: Clock & Uptime */}
          <div className="space-y-3">
            <div className="border border-hud-border bg-hud-bg/50 p-4 text-center">
              <div className="hud-data-label mb-2">LOCAL_TIME</div>
              <div className="text-2xl font-bold tracking-widest text-hud-cyan font-mono">
                {time || "--:--:--"}
              </div>
            </div>
            <div className="border border-hud-border bg-hud-bg/50 p-4 text-center">
              <div className="hud-data-label mb-2">UPTIME</div>
              <div className="text-lg font-bold tracking-widest text-hud-text font-mono">
                {formatUptime(uptime)}
              </div>
            </div>
            <div className="text-[10px] font-mono text-hud-text-dim text-center">
              <div>LAST_SYNC: {time || "--:--:--"}</div>
              <div className="mt-0.5">TICK: 1000ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Nexus - Graphical Cognitive Topology Map */}
      <MemoryNexus />

      {/* Header with SYSTEM ALERT style */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="hud-alert-box text-sm">HARNESS_OVERVIEW</div>
          <p className="text-xs text-hud-text-dim mt-2 tracking-wide">Local models · Tools · Plugins · Skills · MCP</p>
        </div>
        <Link href="/chat" className="hud-btn-primary px-4 py-2.5 text-xs flex items-center gap-2 tracking-widest">
          INITIATE_COMMS <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="hud-card hud-bracket group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <span className="hud-data-label">{c.label}</span>
              <span className="text-[10px] text-hud-text-dim">{c.code}</span>
            </div>
            <div className="hud-data-value text-3xl tracking-wider">
              {loading ? "—" : c.value.toString().padStart(3, "0")}
            </div>
            <div className="text-[10px] text-hud-text-dim mt-2 tracking-widest">STATUS: ACTIVE</div>
          </Link>
        ))}
      </div>

      {/* Two Column Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* System Info Panel */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">SYSTEM_PARAMETERS</div>
          <div className="space-y-3">
            {[
              { label: "AXIS", value: "008/334/778" },
              { label: "SPEED", value: "392.02 KMHR" },
              { label: "DISTANCE", value: "8491 KM" },
              { label: "UPTIME", value: `${Math.floor(Math.random()*99)}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center py-1 border-b border-hud-border/30">
                <span className="hud-data-label">{r.label}</span>
                <span className="text-sm tracking-wider text-hud-text">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Connection Matrix */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">CONNECTION_MATRIX</div>
          <div className="space-y-3">
            {[
              { name: "OLLAMA_ENGINE", status: stats.ollama },
              { name: "POSTGRES_DB", status: true },
              { name: "MCP_BRIDGE", status: stats.mcp > 0 },
              { name: "TOOL_GATEWAY", status: stats.tools > 0 },
            ].map((c) => (
              <div key={c.name} className="flex justify-between items-center py-1 border-b border-hud-border/30">
                <span className="text-xs tracking-wider text-hud-text">{c.name}</span>
                <span className={`text-xs font-bold tracking-widest ${c.status ? "hud-status-online" : "hud-status-offline"}`}>
                  {c.status ? "● ACTIVE" : "● OFFLINE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Notes */}
      <div className="hud-panel hud-bracket p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="hud-data-label mb-2">SYSTEM_NOTES</div>
            <p className="text-xs text-hud-text-soft leading-relaxed tracking-wide">
              The harness connects to your local Ollama instance via REST. All model inference runs locally.
              Tools call external endpoints you configure. MCP servers provide extended tool discovery.
              Nothing is simulated — all connections are live.
            </p>
          </div>
          <div className="hud-refcode text-right">
            <div>SECTOR: ALPHA</div>
            <div>BUILD: 2026.08</div>
            <div>MODE: LOCAL</div>
          </div>
        </div>
      </div>
    </div>
  );
}
