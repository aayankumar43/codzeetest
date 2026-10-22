"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function SkillsPage() {
  const [skills, setSkills] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", description: "", promptTemplate: "", modelId: "", toolIds: "[]", pluginIds: "[]", parameters: "{}" });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/skills").then(r => r.json());
      setSkills(d.skills || []);
      setModels(d.models || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const add = async () => {
    await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...form,
      modelId: form.modelId ? parseInt(form.modelId) : null,
      toolIds: (() => { try { return JSON.parse(form.toolIds); } catch { return []; } })(),
      pluginIds: (() => { try { return JSON.parse(form.pluginIds); } catch { return []; } })(),
      parameters: (() => { try { return JSON.parse(form.parameters); } catch { return {}; } })(),
      status: "draft",
    }) });
    setForm({ name: "", slug: "", description: "", promptTemplate: "", modelId: "", toolIds: "[]", pluginIds: "[]", parameters: "{}" });
    fetchAll();
  };

  const remove = async (id: number) => { await fetch("/api/skills", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); fetchAll(); };

  return (
    <div className="space-y-6">
      <div>
        <div className="hud-alert-box text-sm mb-2">SKILLS</div>
        <p className="text-xs text-hud-text-dim tracking-wide">Compose model + tools + plugins into reusable inference workflows</p>
      </div>

      <div className="hud-panel hud-bracket p-5">
        <div className="hud-data-label mb-3">BUILD_SKILL</div>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-2">
          <input className="hud-input px-3 py-2" placeholder="NAME" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="hud-input px-3 py-2" placeholder="SLUG" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          <select className="hud-input px-3 py-2" value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })}>
            <option value="">SELECT_MODEL</option>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="hud-input px-3 py-2" placeholder="TOOL_IDS_JSON" value={form.toolIds} onChange={e => setForm({ ...form, toolIds: e.target.value })} />
          <input className="hud-input px-3 py-2" placeholder="PLUGIN_IDS_JSON" value={form.pluginIds} onChange={e => setForm({ ...form, pluginIds: e.target.value })} />
          <button onClick={add} className="hud-btn-primary px-3 py-2">
            CREATE
          </button>
        </div>
        <textarea className="hud-input mt-3 w-full px-3 py-2" rows={3} placeholder="PROMPT_TEMPLATE // SYSTEM_INSTRUCTION" value={form.promptTemplate} onChange={e => setForm({ ...form, promptTemplate: e.target.value })} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s: any) => (
          <div key={s.id} className="hud-card hud-bracket">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="hud-data-label">SKILL_ID</div>
                <div className="text-sm font-bold tracking-wider mt-1">{s.name}</div>
                <div className="text-[10px] text-hud-text-dim mt-1 font-mono">{s.slug} · {s.status?.toUpperCase()}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                s.status === "active" 
                  ? "bg-hud-green-dim text-hud-green border-hud-green/40" 
                  : "border-hud-border text-hud-text-dim"
              }`}>
                {s.status?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-hud-text-soft mb-2">{s.description || "NO_DESCRIPTION"}</p>
            <div className="text-[10px] text-hud-text-dim font-mono space-y-0.5">
              <div>MODEL: <span className="text-hud-text">{s.modelName || "NONE"}</span></div>
              <div>TOOLS: <span className="text-hud-text">{s.toolCount}</span> · PLUGINS: <span className="text-hud-text">{s.pluginCount}</span> · USES: <span className="text-hud-text">{s.usageCount || 0}</span></div>
            </div>
            <div className="flex gap-2 mt-3">
              <a href={`/chat?skillId=${s.id}`} className="hud-btn-primary flex-1 px-3 py-1.5 text-center">
                RUN
              </a>
              <button onClick={() => remove(s.id)} className="hud-btn-danger px-3 py-1.5">
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
