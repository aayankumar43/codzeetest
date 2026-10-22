"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", endpoint: "", method: "GET", authType: "none", description: "", schema: "{}" });

  const fetchAll = async () => {
    setLoading(true);
    const r = await fetch("/api/tools");
    const d = await r.json();
    setTools(d.tools || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const add = async () => {
    await fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, schema: (() => { try { return JSON.parse(form.schema); } catch { return {}; } })() }) });
    setForm({ name: "", slug: "", endpoint: "", method: "GET", authType: "none", description: "", schema: "{}" });
    fetchAll();
  };

  const update = async (t: any) => {
    await fetch("/api/tools", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    fetchAll();
  };

  const remove = async (id: number) => {
    await fetch("/api/tools", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="hud-alert-box text-sm mb-2">TOOL_CONNECTOR</div>
        <p className="text-xs text-hud-text-dim tracking-wide">Register external endpoints for harness integration</p>
      </div>

      <div className="hud-panel hud-bracket p-5">
        <div className="hud-data-label mb-3">NEW_TOOL</div>
        <div className="grid md:grid-cols-7 gap-2">
          <input className="hud-input px-3 py-2" placeholder="NAME" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="hud-input px-3 py-2" placeholder="SLUG" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          <input className="md:col-span-2 hud-input px-3 py-2" placeholder="ENDPOINT_URL" value={form.endpoint} onChange={e => setForm({ ...form, endpoint: e.target.value })} />
          <select className="hud-input px-3 py-2" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option>GET</option><option>POST</option><option>PUT</option></select>
          <input className="hud-input px-3 py-2" placeholder="AUTH_TYPE" value={form.authType} onChange={e => setForm({ ...form, authType: e.target.value })} />
          <button onClick={add} className="hud-btn-primary px-3 py-2">
            CREATE
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((t: any) => (
          <div key={t.id} className="hud-card hud-bracket">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="hud-data-label">TOOL_ID</div>
                <div className="text-sm font-bold tracking-wider mt-1">{t.name}</div>
                <div className="text-[10px] text-hud-text-dim mt-1 font-mono">{t.slug}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                t.status === "connected" 
                  ? "bg-hud-green-dim text-hud-green border-hud-green/40" 
                  : "border-hud-border text-hud-text-dim"
              }`}>
                {t.status?.toUpperCase() || "IDLE"}
              </span>
            </div>
            <div className="text-[11px] text-hud-text font-mono break-all mb-2">{t.endpoint || "— NO_ENDPOINT —"}</div>
            <p className="text-xs text-hud-text-soft">{t.description || "NO_DESCRIPTION"}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => update({ ...t, status: t.status === "connected" ? "disconnected" : "connected" })} className="hud-btn flex-1 px-3 py-1.5">
                {t.status === "connected" ? "DISCONNECT" : "TEST_LINK"}
              </button>
              <button onClick={() => remove(t.id)} className="hud-btn-danger px-3 py-1.5">
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
