"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ollama" | "omniroute" | "openrouter">("ollama");
  const [loading, setLoading] = useState(true);
  const [ollamaForm, setOllamaForm] = useState({ ollamaName: "", name: "", description: "", tag: "latest" });
  const [omnirouteForm, setOmnirouteForm] = useState({ omnirouteModelId: "", name: "", description: "", tag: "latest" });
  const [openrouterForm, setOpenRouterForm] = useState({ openrouterModelId: "", name: "", description: "", tag: "latest" });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [m, o, or, op] = await Promise.all([
        fetch("/api/models").then(r => r.json()),
        fetch("/api/ollama/status").then(r => r.json()),
        fetch("/api/omniroute/status").then(r => r.json()),
        fetch("/api/openrouter/status").then(r => r.json()),
      ]);
      setModels(m.models || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const addOllama = async () => {
    if (!ollamaForm.ollamaName) return;
    await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ollamaForm, source: "ollama" }) });
    setOllamaForm({ ollamaName: "", name: "", description: "", tag: "latest" });
    fetchAll();
  };

  const addOmniroute = async () => {
    if (!omnirouteForm.omnirouteModelId) return;
    await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...omnirouteForm, source: "omniroute" }) });
    setOmnirouteForm({ omnirouteModelId: "", name: "", description: "", tag: "latest" });
    fetchAll();
  };

  const addOpenRouter = async () => {
    if (!openrouterForm.openrouterModelId) return;
    await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...openrouterForm, source: "openrouter" }) });
    setOpenRouterForm({ openrouterModelId: "", name: "", description: "", tag: "latest" });
    fetchAll();
  };

  const pull = async (name: string) => {
    await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pull", name }) });
    fetchAll();
  };

  const remove = async (id: number) => {
    await fetch("/api/models", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchAll();
  };

  const ollamaModels = models.filter(m => m.source === "ollama" || !m.source);
  const omnirouteModels = models.filter(m => m.source === "omniroute");
  const openrouterModels = models.filter(m => m.source === "openrouter");

  return (
    <div className="space-y-6">
      <div>
        <div className="hud-alert-box text-sm mb-2">MODELS</div>
        <p className="text-xs text-hud-text-dim tracking-wide">Link Ollama or Omniroute models to the harness</p>
      </div>

      {/* Tab Selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("ollama")}
          className={`hud-btn px-4 py-2 text-xs ${activeTab === "ollama" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
        >
          OLLAMA_LOCAL
        </button>
        <button
          onClick={() => setActiveTab("omniroute")}
          className={`hud-btn px-4 py-2 text-xs ${activeTab === "omniroute" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
        >
          OMNIRROUTE_GW
        </button>
        <button
          onClick={() => setActiveTab("openrouter")}
          className={`hud-btn px-4 py-2 text-xs ${activeTab === "openrouter" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
        >
          OPENROUTER_CLOUD
        </button>
      </div>

      {/* Ollama Registration */}
      {activeTab === "ollama" && (
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">REGISTER_OLLAMA_MODEL // LOCAL_INFERENCE</div>
          <div className="grid md:grid-cols-4 gap-3">
            <input className="hud-input px-3 py-2" placeholder="OLLAMA_NAME (e.g. llama3)" value={ollamaForm.ollamaName} onChange={e => setOllamaForm({ ...ollamaForm, ollamaName: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="DISPLAY_NAME" value={ollamaForm.name} onChange={e => setOllamaForm({ ...ollamaForm, name: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="TAG" value={ollamaForm.tag} onChange={e => setOllamaForm({ ...ollamaForm, tag: e.target.value })} />
            <button onClick={addOllama} className="hud-btn-primary px-4 py-2">
              REGISTER
            </button>
          </div>
        </div>
      )}

      {/* Omniroute Registration */}
      {activeTab === "omniroute" && (
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">REGISTER_OMNIRROUTE_MODEL // SELF_HOSTED_GATEWAY</div>
          <div className="grid md:grid-cols-4 gap-3">
            <input className="hud-input px-3 py-2" placeholder="MODEL_ID (e.g. openai/gpt-4)" value={omnirouteForm.omnirouteModelId} onChange={e => setOmnirouteForm({ ...omnirouteForm, omnirouteModelId: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="DISPLAY_NAME" value={omnirouteForm.name} onChange={e => setOmnirouteForm({ ...omnirouteForm, name: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="TAG" value={omnirouteForm.tag} onChange={e => setOmnirouteForm({ ...omnirouteForm, tag: e.target.value })} />
            <button onClick={addOmniroute} className="hud-btn-primary px-4 py-2">
              REGISTER
            </button>
          </div>
          <div className="text-[10px] text-hud-text-dim mt-2">Configure gateway at Settings → OMNIRROUTE_CONNECTION</div>
        </div>
      )}

      {/* OpenRouter Registration */}
      {activeTab === "openrouter" && (
        <div className="hud-panel hud-bracket p-5">
          <div className="hud-data-label mb-3">REGISTER_OPENROUTER_MODEL // CLOUD_MULTIPROVIDER</div>
          <div className="grid md:grid-cols-4 gap-3">
            <input className="hud-input px-3 py-2" placeholder="MODEL_ID (e.g. openai/gpt-4o)" value={openrouterForm.openrouterModelId} onChange={e => setOpenRouterForm({ ...openrouterForm, openrouterModelId: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="DISPLAY_NAME" value={openrouterForm.name} onChange={e => setOpenRouterForm({ ...openrouterForm, name: e.target.value })} />
            <input className="hud-input px-3 py-2" placeholder="TAG" value={openrouterForm.tag} onChange={e => setOpenRouterForm({ ...openrouterForm, tag: e.target.value })} />
            <button onClick={addOpenRouter} className="hud-btn-primary px-4 py-2">
              REGISTER
            </button>
          </div>
          <div className="text-[10px] text-hud-text-dim mt-2">Requires API key from openrouter.ai/keys — configure at Settings → OPENROUTER</div>
        </div>
      )}

      {/* Model Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(activeTab === "ollama" ? ollamaModels : activeTab === "omniroute" ? omnirouteModels : openrouterModels).map((m: any) => {
          const statusKey = m.source === "omniroute" ? "omnirouteStatus" : m.source === "openrouter" ? "openrouterStatus" : "ollamaStatus";
          const idKey = m.source === "omniroute" ? "omnirouteModelId" : m.source === "openrouter" ? "openrouterModelId" : "ollamaName";
          return (
            <div key={m.id} className="hud-card hud-bracket">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="hud-data-label">MODEL_ID</div>
                  <div className="text-sm font-bold tracking-wider mt-1">{m.name}</div>
                  <div className="text-[10px] text-hud-text-dim mt-1 font-mono break-all">
                    {m[idKey]}
                  </div>
                  <div className="text-[10px] text-hud-text-dim mt-0.5">
                    SOURCE: {m.source?.toUpperCase() || "OLLAMA"}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                  m[statusKey] === "available"
                    ? "bg-hud-green-dim text-hud-green border-hud-green/40"
                    : "border-hud-border text-hud-text-dim"
                }`}>
                  {(m[statusKey] || "UNKNOWN").toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-hud-text-soft mb-3">{m.description || "NO_DESCRIPTION"}</p>
              <div className="flex gap-2">
                {m.source === "ollama" && (
                  <button onClick={() => pull(m.ollamaName)} className="hud-btn flex-1 px-3 py-1.5">
                    PULL
                  </button>
                )}
                <button onClick={() => remove(m.id)} className="hud-btn-danger px-3 py-1.5">
                  DEL
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={fetchAll} className="hud-btn px-4 py-2 flex items-center gap-2">
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH_LIST
      </button>
    </div>
  );
}
