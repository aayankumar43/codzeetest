"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", version: "1.0.0", description: "" });

  const fetchAll = async () => { setLoading(true); const d = await fetch("/api/plugins").then(r => r.json()); setPlugins(d.plugins || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);

  const add = async () => { await fetch("/api/plugins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setForm({ name: "", slug: "", version: "1.0.0", description: "" }); fetchAll(); };
  const update = async (p: any) => { await fetch("/api/plugins", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); fetchAll(); };
  const remove = async (id: number) => { await fetch("/api/plugins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); fetchAll(); };

  return (
    <div className="space-y-6">
      <div>
        <div className="hud-alert-box text-sm mb-2">PLUGINS</div>
        <p className="text-xs text-hud-text-dim tracking-wide">Load extensions providing skills and integrations</p>
      </div>

      <div className="hud-panel hud-bracket p-5">
        <div className="hud-data-label mb-3">NEW_PLUGIN</div>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="hud-input px-3 py-2" placeholder="NAME" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="hud-input px-3 py-2" placeholder="SLUG" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          <input className="hud-input px-3 py-2" placeholder="VERSION" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
          <button onClick={add} className="hud-btn-primary px-4 py-2">
            CREATE
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((p: any) => (
          <div key={p.id} className="hud-card hud-bracket">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="hud-data-label">PLUGIN_ID</div>
                <div className="text-sm font-bold tracking-wider mt-1">{p.name}</div>
                <div className="text-[10px] text-hud-text-dim mt-1 font-mono">{p.slug} · v{p.version}</div>
              </div>
              <button 
                onClick={() => update({ ...p, status: p.status === "enabled" ? "disabled" : "enabled" })}
                className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                  p.status === "enabled" 
                    ? "bg-hud-green-dim text-hud-green border-hud-green/40" 
                    : "border-hud-border text-hud-text-dim"
                }`}
              >
                {p.status?.toUpperCase()}
              </button>
            </div>
            <p className="text-xs text-hud-text-soft">{p.description || "NO_DESCRIPTION"}</p>
            <div className="text-[10px] text-hud-text-dim mt-2 font-mono">SKILLS_LINKED: {Array.isArray(p.skills) ? p.skills.length : 0}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => update({ ...p, status: p.status === "enabled" ? "disabled" : "enabled" })} className="hud-btn flex-1 px-3 py-1.5">
                TOGGLE
              </button>
              <button onClick={() => remove(p.id)} className="hud-btn-danger px-3 py-1.5">
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={fetchAll} className="hud-btn px-4 py-2 flex items-center gap-2">
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH_LIST
      </button>
    </div>
  );
}
