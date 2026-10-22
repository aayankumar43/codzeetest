"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [ollamaHost, setOllamaHost] = useState("http://localhost:11434");
  const [omnirouteUrl, setOmnirouteUrl] = useState("http://localhost:20128/v1");
  const [omnirouteKey, setOmnirouteKey] = useState("");
  const [openrouterUrl, setOpenRouterUrl] = useState("https://openrouter.ai/api/v1");
  const [openrouterKey, setOpenRouterKey] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [omnirouteStatus, setOmnirouteStatus] = useState<any>(null);
  const [openrouterStatus, setOpenRouterStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchConfig = async () => {
    const d = await fetch("/api/settings").then(r => r.json());
    if (d.ok) {
      setCfg(d.config || {});
      setOllamaHost(d.config?.ollama_host || "http://localhost:11434");
      setOmnirouteUrl(d.config?.omniroute_base_url || "http://localhost:20128/v1");
      setOmnirouteKey(d.config?.omniroute_api_key || "");
      setOpenRouterUrl(d.config?.openrouter_base_url || "https://openrouter.ai/api/v1");
      setOpenRouterKey(d.config?.openrouter_api_key || "");
    }
  };

  const check = async () => {
    setLoading(true);
    try {
      const [o, or, op] = await Promise.all([
        fetch("/api/ollama/status").then(r => r.json()),
        fetch("/api/omniroute/status").then(r => r.json()),
        fetch("/api/openrouter/status").then(r => r.json()),
      ]);
      setOllamaStatus(o);
      setOmnirouteStatus(or);
      setOpenRouterStatus(op);
    } finally { setLoading(false); }
  };

  const saveConfig = async (key: string, value: string) => {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await fetchConfig();
  };

  useEffect(() => { fetchConfig(); check(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="hud-alert-box text-sm mb-2">CONFIG_PANEL</div>
        <p className="text-xs text-hud-text-dim tracking-wide">Configure harness parameters and verify connectivity</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Ollama Connection */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">OLLAMA_CONNECTION</div>
          <div className="flex items-center gap-3 p-3 border border-hud-border bg-hud-bg mb-3">
            <span className={`w-2 h-2 ${ollamaStatus?.ollamaConnected ? "bg-hud-green shadow-[0_0_6px_rgba(123,224,160,0.8)]" : "bg-hud-red shadow-[0_0_6px_rgba(204,51,34,0.8)]"}`} />
            <span className={`text-xs font-bold tracking-widest ${ollamaStatus?.ollamaConnected ? "hud-status-online" : "hud-status-offline"}`}>
              {ollamaStatus?.ollamaConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          <div className="text-[10px] text-hud-text-dim font-mono mb-2">
            STORAGE: app_config // KEY: ollama_host
          </div>
          <div className="flex gap-2">
            <input className="hud-input flex-1 px-3 py-2" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)} />
            <button onClick={() => saveConfig("ollama_host", ollamaHost)} className="hud-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest flex items-center gap-1">
              <Save className="w-3 h-3" /> {saved ? "SAVED" : "SAVE"}
            </button>
          </div>
          <div className="mt-2 text-[10px] font-mono text-hud-text-soft">{cfg.ollama_host || "NOT_SET"}</div>
        </div>

        {/* Omniroute Connection */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">OMNIRROUTE_CONNECTION</div>
          <div className="flex items-center gap-3 p-3 border border-hud-border bg-hud-bg mb-3">
            <span className={`w-2 h-2 ${omnirouteStatus?.omnirouteConnected ? "bg-hud-green shadow-[0_0_6px_rgba(123,224,160,0.8)]" : "bg-hud-red shadow-[0_0_6px_rgba(204,51,34,0.8)]"}`} />
            <span className={`text-xs font-bold tracking-widest ${omnirouteStatus?.omnirouteConnected ? "hud-status-online" : "hud-status-offline"}`}>
              {omnirouteStatus?.omnirouteConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          <div className="text-[10px] text-hud-text-dim font-mono mb-2">
            STORAGE: app_config // KEYS: omniroute_base_url, omniroute_api_key
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="hud-input flex-1 px-3 py-2" placeholder="BASE_URL" value={omnirouteUrl} onChange={e => setOmnirouteUrl(e.target.value)} />
              <button onClick={() => saveConfig("omniroute_base_url", omnirouteUrl)} className="hud-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest">
                SAVE_URL
              </button>
            </div>
            <div className="flex gap-2">
              <input className="hud-input flex-1 px-3 py-2" placeholder="API_KEY" type="password" value={omnirouteKey} onChange={e => setOmnirouteKey(e.target.value)} />
              <button onClick={() => saveConfig("omniroute_api_key", omnirouteKey)} className="hud-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest">
                SAVE_KEY
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] font-mono text-hud-text-soft">{cfg.omniroute_base_url || "NOT_SET"}</div>
        </div>

        {/* OpenRouter Connection */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">OPENROUTER_CONNECTION</div>
          <div className="flex items-center gap-3 p-3 border border-hud-border bg-hud-bg mb-3">
            <span className={`w-2 h-2 ${openrouterStatus?.openrouterConnected ? "bg-hud-green shadow-[0_0_6px_rgba(123,224,160,0.8)]" : "bg-hud-red shadow-[0_0_6px_rgba(204,51,34,0.8)]"}`} />
            <span className={`text-xs font-bold tracking-widest ${openrouterStatus?.openrouterConnected ? "hud-status-online" : "hud-status-offline"}`}>
              {openrouterStatus?.openrouterConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
            {openrouterStatus?.modelCount != null && (
              <span className="text-[10px] text-hud-text-dim ml-2">{openrouterStatus.modelCount} models</span>
            )}
          </div>
          <div className="text-[10px] text-hud-text-dim font-mono mb-2">
            STORAGE: app_config // KEYS: openrouter_base_url, openrouter_api_key
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="hud-input flex-1 px-3 py-2" placeholder="BASE_URL" value={openrouterUrl} onChange={e => setOpenRouterUrl(e.target.value)} />
              <button onClick={() => saveConfig("openrouter_base_url", openrouterUrl)} className="hud-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest">
                SAVE_URL
              </button>
            </div>
            <div className="flex gap-2">
              <input className="hud-input flex-1 px-3 py-2" placeholder="API_KEY (openrouter.ai/keys)" type="password" value={openrouterKey} onChange={e => setOpenRouterKey(e.target.value)} />
              <button onClick={() => saveConfig("openrouter_api_key", openrouterKey)} className="hud-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest">
                SAVE_KEY
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] font-mono text-hud-text-soft break-all">{cfg.openrouter_base_url || "NOT_SET"}</div>
        </div>

        {/* System Info */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">SYSTEM_INFO</div>
          <div className="space-y-2">
            {[
              { label: "DATABASE", value: "POSTGRES_DRIZZLE", color: "hud-status-online" },
              { label: "ORM_LAYER", value: "DRIZZLE_ORM", color: "text-hud-text" },
              { label: "BACKEND", value: "NEXTJS_APP_ROUTER", color: "text-hud-text" },
              { label: "INFERENCE", value: "OLLAMA_REST_LOCAL", color: "text-hud-text" },
              { label: "MCP_LAYER", value: "@MCP_SDK", color: "text-hud-text" },
              { label: "RUNTIME", value: "NODE_TYPESCRIPT", color: "text-hud-text" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-hud-border/30">
                <span className="hud-data-label">{r.label}</span>
                <span className={`text-xs font-bold tracking-widest ${r.color}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Session Log */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">SESSION_LOG</div>
          <div className="space-y-2 font-mono">
            {[
              { time: "00:00:01", event: "HARNESS_INIT", status: "OK" },
              { time: "00:00:02", event: "DB_CONNECT", status: "OK" },
              { time: "00:00:03", event: "OLLAMA_PROBE", status: ollamaStatus?.ollamaConnected ? "OK" : "FAIL" },
              { time: "00:00:04", event: "OMNIRROUTE_PROBE", status: omnirouteStatus?.omnirouteConnected ? "OK" : "FAIL" },
              { time: "00:00:05", event: "OPENROUTER_PROBE", status: openrouterStatus?.openrouterConnected ? "OK" : "FAIL" },
              { time: "00:00:06", event: "MCP_BRIDGE_READY", status: "OK" },
              { time: "00:00:06", event: "CONFIG_LOADED", status: "OK" },
            ].map((l, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-hud-border/30 text-xs">
                <span className="text-hud-text-dim text-[10px]">[{l.time}]</span>
                <span className="tracking-wider">{l.event}</span>
                <span className={`text-[10px] font-bold tracking-widest ${l.status === "OK" ? "hud-status-online" : "hud-status-offline"}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostics */}
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">DIAGNOSTICS</div>
          <div className="space-y-3">
            <div>
              <div className="hud-data-label">ENVIRONMENT</div>
              <div className="font-mono text-xs mt-0.5 tracking-wider">{process.env.NODE_ENV === "production" ? "PROD" : "DEV"}</div>
            </div>
            <div>
              <div className="hud-data-label">HARNESS_VERSION</div>
              <div className="font-mono text-xs mt-0.5 tracking-wider">2.1.0</div>
            </div>
            <div>
              <div className="hud-data-label">PROTOCOLS</div>
              <div className="font-mono text-xs mt-0.5 tracking-wider">OLLAMA_REST // MCP_STDIO // HTTP_JSON</div>
            </div>
            <div>
              <div className="hud-data-label">STORAGE</div>
              <div className="font-mono text-xs mt-0.5 tracking-wider">POSTGRES // DRIZZLE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
