"use client";
import { useEffect, useState } from "react";
import { Bot, RefreshCw, Trash2, Play, Clock, Pause, Settings2, ChevronDown, ChevronUp, X } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [executingId, setExecutingId] = useState<number | null>(null);
  const [execInput, setExecInput] = useState<Record<number, string>>({});
  const [execOutput, setExecOutput] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    systemPrompt: "",
    modelId: "",
    skillId: "",
    toolIds: [] as number[],
    pluginIds: [] as number[],
    mcpServerIds: [] as number[],
    triggerMode: "manual" as "manual" | "scheduled" | "webhook",
    scheduleCron: "",
    webhookUrl: "",
    maxIterations: "10",
    timeoutMs: "60000",
    temperature: "0.7",
    top_p: "0.9",
    max_tokens: "1024",
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/agents").then(r => r.json());
      setAgents(d.agents || []);
      setModels(d.models || []);
      setSkills(d.skills || []);
      setTools(d.tools || []);
      setPlugins(d.plugins || []);
      setMcpServers(d.mcpServers || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => {
    setForm({
      name: "", slug: "", description: "", systemPrompt: "",
      modelId: "", skillId: "",
      toolIds: [], pluginIds: [], mcpServerIds: [],
      triggerMode: "manual", scheduleCron: "", webhookUrl: "",
      maxIterations: "10", timeoutMs: "60000",
      temperature: "0.7", top_p: "0.9", max_tokens: "1024",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editAgent = (a: any) => {
    setForm({
      name: a.name,
      slug: a.slug,
      description: a.description || "",
      systemPrompt: a.systemPrompt || "",
      modelId: a.modelId || "",
      skillId: a.skillId || "",
      toolIds: a.toolIds || [],
      pluginIds: a.pluginIds || [],
      mcpServerIds: a.mcpServerIds || [],
      triggerMode: a.triggerMode || "manual",
      scheduleCron: a.scheduleCron || "",
      webhookUrl: a.webhookUrl || "",
      maxIterations: String(a.maxIterations || 10),
      timeoutMs: String(a.timeoutMs || 60000),
      temperature: String((a.parameters?.temperature) ?? 0.7),
      top_p: String((a.parameters?.top_p) ?? 0.9),
      max_tokens: String((a.parameters?.max_tokens) ?? 1024),
    });
    setEditingId(a.id);
    setShowForm(true);
  };

  const saveAgent = async () => {
    const payload = {
      ...form,
      modelId: form.modelId ? parseInt(form.modelId) : null,
      skillId: form.skillId ? parseInt(form.skillId) : null,
      maxIterations: parseInt(form.maxIterations),
      timeoutMs: parseInt(form.timeoutMs),
      parameters: {
        temperature: parseFloat(form.temperature),
        top_p: parseFloat(form.top_p),
        max_tokens: parseInt(form.max_tokens),
      },
    };

    if (editingId) {
      await fetch("/api/agents", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...payload }) });
    } else {
      await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...payload }) });
    }
    resetForm();
    fetchAll();
  };

  const toggleStatus = async (a: any) => {
    const newStatus = a.status === "active" ? "paused" : "active";
    await fetch("/api/agents", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, status: newStatus }) });
    fetchAll();
  };

  const removeAgent = async (id: number) => {
    await fetch("/api/agents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchAll();
  };

  const executeAgent = async (agentId: number) => {
    setExecutingId(agentId);
    setExecOutput(prev => ({ ...prev, [agentId]: "EXECUTING..." }));
    try {
      const d = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", agentId, input: execInput[agentId] || undefined }),
      }).then(r => r.json());
      if (d.ok) {
        setExecOutput(prev => ({ ...prev, [agentId]: d.output || "Completed (no output)" }));
      } else {
        setExecOutput(prev => ({ ...prev, [agentId]: `ERROR: ${d.error}` }));
      }
    } catch (e: any) {
      setExecOutput(prev => ({ ...prev, [agentId]: `ERROR: ${e.message}` }));
    } finally {
      setExecutingId(null);
    }
  };

  const toggleTool = (id: number) => {
    setForm(f => ({
      ...f,
      toolIds: f.toolIds.includes(id) ? f.toolIds.filter(x => x !== id) : [...f.toolIds, id],
    }));
  };
  const togglePlugin = (id: number) => {
    setForm(f => ({
      ...f,
      pluginIds: f.pluginIds.includes(id) ? f.pluginIds.filter(x => x !== id) : [...f.pluginIds, id],
    }));
  };
  const toggleMcp = (id: number) => {
    setForm(f => ({
      ...f,
      mcpServerIds: f.mcpServerIds.includes(id) ? f.mcpServerIds.filter(x => x !== id) : [...f.mcpServerIds, id],
    }));
  };

  const statusColor = (s: string) =>
    s === "active" ? "bg-hud-green-dim text-hud-green border-hud-green/40"
    : s === "paused" ? "bg-hud-amber-dim text-hud-amber border-hud-amber/40"
    : "border-hud-border text-hud-text-dim";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="hud-alert-box text-sm mb-2">AGENTS</div>
          <p className="text-xs text-hud-text-dim tracking-wide">Create autonomous agents for repetitive tasks with full model/tool/MCP integration</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="hud-btn px-3 py-2 flex items-center gap-2 text-xs">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="hud-btn-primary px-3 py-2 flex items-center gap-2 text-xs">
            <Bot className="w-4 h-4" /> NEW_AGENT
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="hud-panel hud-bracket p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="hud-data-label">{editingId ? "EDIT_AGENT" : "CREATE_AGENT"} // {editingId ? `ID_${editingId}` : "NEW"}</div>
            <button onClick={resetForm} className="hud-btn px-2 py-1 text-[10px]"><X className="w-3 h-3" /></button>
          </div>

          {/* Basic Info */}
          <div>
            <div className="hud-data-label mb-2">BASIC_INFO</div>
            <div className="grid md:grid-cols-3 gap-2">
              <input className="hud-input px-3 py-2" placeholder="NAME" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="hud-input px-3 py-2" placeholder="SLUG" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
              <input className="hud-input px-3 py-2" placeholder="DESCRIPTION" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          {/* Model & Skill */}
          <div>
            <div className="hud-data-label mb-2">MODEL_SKILL_BINDING</div>
            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <label className="hud-data-label block mb-1">PRIMARY_MODEL</label>
                <select className="hud-input w-full px-3 py-2" value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })}>
                  <option value="">// SELECT_MODEL</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.source || "ollama"})</option>)}
                </select>
              </div>
              <div>
                <label className="hud-data-label block mb-1">SKILL_TEMPLATE (OPTIONAL)</label>
                <select className="hud-input w-full px-3 py-2" value={form.skillId} onChange={e => setForm({ ...form, skillId: e.target.value })}>
                  <option value="">// NO_SKILL // DIRECT_PROMPT</option>
                  {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <div className="hud-data-label mb-2">SYSTEM_PROMPT // PERSONA</div>
            <textarea
              className="hud-input w-full px-3 py-2"
              rows={4}
              placeholder="Define the agent's persona, objectives, and behavioral rules..."
              value={form.systemPrompt}
              onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
            />
          </div>

          {/* Tool Access */}
          <div>
            <div className="hud-data-label mb-2">TOOL_ACCESS ({form.toolIds.length} SELECTED)</div>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-hud-border p-2 bg-hud-bg">
              {tools.length === 0 ? <span className="text-xs text-hud-text-dim">NO_TOOLS_AVAILABLE</span> :
                tools.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`text-[10px] px-2 py-1 border tracking-wider ${
                      form.toolIds.includes(t.id)
                        ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan/50"
                        : "border-hud-border text-hud-text-dim hover:text-hud-text"
                    }`}
                  >
                    {t.name}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Plugin Access */}
          <div>
            <div className="hud-data-label mb-2">PLUGIN_ACCESS ({form.pluginIds.length} SELECTED)</div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border border-hud-border p-2 bg-hud-bg">
              {plugins.length === 0 ? <span className="text-xs text-hud-text-dim">NO_PLUGINS_AVAILABLE</span> :
                plugins.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlugin(p.id)}
                    className={`text-[10px] px-2 py-1 border tracking-wider ${
                      form.pluginIds.includes(p.id)
                        ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan/50"
                        : "border-hud-border text-hud-text-dim hover:text-hud-text"
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              }
            </div>
          </div>

          {/* MCP Access */}
          <div>
            <div className="hud-data-label mb-2">MCP_SERVER_ACCESS ({form.mcpServerIds.length} SELECTED)</div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border border-hud-border p-2 bg-hud-bg">
              {mcpServers.length === 0 ? <span className="text-xs text-hud-text-dim">NO_MCP_SERVERS</span> :
                mcpServers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleMcp(s.id)}
                    className={`text-[10px] px-2 py-1 border tracking-wider ${
                      form.mcpServerIds.includes(s.id)
                        ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan/50"
                        : "border-hud-border text-hud-text-dim hover:text-hud-text"
                    }`}
                  >
                    {s.name}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Trigger Mode */}
          <div>
            <div className="hud-data-label mb-2">TRIGGER_MODE</div>
            <div className="grid md:grid-cols-3 gap-2">
              <button
                onClick={() => setForm({ ...form, triggerMode: "manual" })}
                className={`hud-btn py-2 text-xs ${form.triggerMode === "manual" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
              >
                MANUAL
              </button>
              <button
                onClick={() => setForm({ ...form, triggerMode: "scheduled" })}
                className={`hud-btn py-2 text-xs ${form.triggerMode === "scheduled" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
              >
                SCHEDULED
              </button>
              <button
                onClick={() => setForm({ ...form, triggerMode: "webhook" })}
                className={`hud-btn py-2 text-xs ${form.triggerMode === "webhook" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
              >
                WEBHOOK
              </button>
            </div>
            {form.triggerMode === "scheduled" && (
              <input
                className="hud-input w-full mt-2 px-3 py-2"
                placeholder="CRON_EXPRESSION (e.g. 0 */6 * * *)"
                value={form.scheduleCron}
                onChange={e => setForm({ ...form, scheduleCron: e.target.value })}
              />
            )}
            {form.triggerMode === "webhook" && (
              <input
                className="hud-input w-full mt-2 px-3 py-2"
                placeholder="WEBHOOK_URL"
                value={form.webhookUrl}
                onChange={e => setForm({ ...form, webhookUrl: e.target.value })}
              />
            )}
          </div>

          {/* Execution Parameters */}
          <div>
            <div className="hud-data-label mb-2">EXECUTION_PARAMETERS</div>
            <div className="grid md:grid-cols-3 gap-2">
              <div>
                <label className="hud-data-label block mb-1">MAX_ITERATIONS</label>
                <input className="hud-input w-full px-3 py-2" type="number" value={form.maxIterations} onChange={e => setForm({ ...form, maxIterations: e.target.value })} />
              </div>
              <div>
                <label className="hud-data-label block mb-1">TIMEOUT_MS</label>
                <input className="hud-input w-full px-3 py-2" type="number" value={form.timeoutMs} onChange={e => setForm({ ...form, timeoutMs: e.target.value })} />
              </div>
              <div>
                <label className="hud-data-label block mb-1">MAX_TOKENS</label>
                <input className="hud-input w-full px-3 py-2" type="number" value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Inference Parameters */}
          <div>
            <div className="hud-data-label mb-2">INFERENCE_PARAMETERS</div>
            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <label className="hud-data-label block mb-1">TEMPERATURE</label>
                <input className="hud-input w-full px-3 py-2" type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} />
              </div>
              <div>
                <label className="hud-data-label block mb-1">TOP_P</label>
                <input className="hud-input w-full px-3 py-2" type="number" step="0.1" min="0" max="1" value={form.top_p} onChange={e => setForm({ ...form, top_p: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-hud-border">
            <button onClick={saveAgent} className="hud-btn-primary px-4 py-2 flex-1 text-xs">
              {editingId ? "SAVE_CHANGES" : "CREATE_AGENT"}
            </button>
            <button onClick={resetForm} className="hud-btn px-4 py-2 text-xs">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((a: any) => (
          <div key={a.id} className="hud-card hud-bracket space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="hud-data-label">AGENT_ID :: {a.id.toString().padStart(3, "0")}</div>
                <div className="text-sm font-bold tracking-wider mt-1">{a.name}</div>
                <div className="text-[10px] text-hud-text-dim mt-1 font-mono">{a.slug}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${statusColor(a.status)}`}>
                {a.status?.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-hud-text-soft">{a.description || "NO_DESCRIPTION"}</p>

            <div className="text-[10px] font-mono text-hud-text-dim space-y-0.5">
              <div>MODEL: <span className="text-hud-text">{models.find(m => m.id === a.modelId)?.name || "NONE"}</span></div>
              <div>SKILL: <span className="text-hud-text">{skills.find(s => s.id === a.skillId)?.name || "DIRECT"}</span></div>
              <div>TRIGGER: <span className="text-hud-text">{a.triggerMode?.toUpperCase()}</span> {a.triggerMode === "scheduled" && a.scheduleCron && <span className="text-hud-cyan">{a.scheduleCron}</span>}</div>
              <div>TOOLS: <span className="text-hud-cyan">{(a.toolIds || []).length}</span> · PLUGINS: <span className="text-hud-cyan">{(a.pluginIds || []).length}</span> · MCP: <span className="text-hud-cyan">{(a.mcpServerIds || []).length}</span></div>
              <div>RUNS: <span className="text-hud-cyan">{a.executionCount || 0}</span> · LAST: <span className="text-hud-text">{a.lastRunAt ? new Date(a.lastRunAt).toLocaleTimeString() : "NEVER"}</span></div>
            </div>

            {/* Execute Input/Output */}
            {execOutput[a.id] && (
              <div className="border border-hud-border p-2 bg-hud-bg">
                <div className="hud-data-label mb-1">LAST_OUTPUT</div>
                <div className="text-[11px] text-hud-text whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{execOutput[a.id]}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => executeAgent(a.id)}
                disabled={executingId === a.id || a.status === "disabled"}
                className="hud-btn-primary flex-1 px-2 py-1.5 text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Play className="w-3 h-3" /> {executingId === a.id ? "RUNNING..." : "EXECUTE"}
              </button>
              <button onClick={() => editAgent(a)} className="hud-btn px-2 py-1.5 text-[10px]">
                <Settings2 className="w-3 h-3" />
              </button>
              <button onClick={() => toggleStatus(a)} className="hud-btn px-2 py-1.5 text-[10px]">
                <Pause className="w-3 h-3" />
              </button>
              <button onClick={() => removeAgent(a.id)} className="hud-btn-danger px-2 py-1.5 text-[10px]">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Execute input inline */}
            <div>
              <input
                className="hud-input w-full px-2 py-1.5 text-[11px]"
                placeholder="> Optional task input for this run..."
                value={execInput[a.id] || ""}
                onChange={e => setExecInput(prev => ({ ...prev, [a.id]: e.target.value }))}
              />
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && !loading && (
        <div className="hud-panel hud-bracket p-8 text-center">
          <div className="text-xs text-hud-text-dim tracking-widest">NO_AGENTS_DEFINED</div>
          <div className="text-[10px] text-hud-text-dim mt-2">Create your first agent using the NEW_AGENT button above</div>
        </div>
      )}
    </div>
  );
}
