"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import type { Node, Edge } from "reactflow";
import {
  Bot,
  Plus,
  Trash2,
  X,
  MessageSquare,
  Send,
  Layout,
  Sparkles,
  Eye,
  Loader2,
} from "lucide-react";

// Dynamically load the Canvas (which uses ReactFlow) — never SSR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CanvasView = dynamic<any>(() => import("../components/CanvasView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-hud-bg border border-hud-border">
      <div className="text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-hud-cyan mb-2" />
        <div className="text-xs text-hud-text-dim tracking-widest">INITIALIZING_CANVAS...</div>
      </div>
    </div>
  ),
});

export default function WorkflowPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [flowMode, setFlowMode] = useState<"manual" | "auto">("manual");
  const [newProject, setNewProject] = useState({ name: "", description: "", requirements: "" });
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  // Canvas state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentNodes, setCurrentNodes] = useState<Node[]>([]);
  const [currentEdges, setCurrentEdges] = useState<Edge[]>([]);

  // Chat state
  const [projectChats, setProjectChats] = useState<any[]>([]);
  const [chatNodeId, setChatNodeId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        fetch("/api/workflow").then(r => r.json()),
        fetch("/api/agents").then(r => r.json()),
      ]);
      setProjects(p.projects || []);
      setAgents(a.agents || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [projectChats]);

  // Expose chat/remove handlers for node buttons
  useEffect(() => {
    (window as any).__wf_chatNode = (nodeId: string) => openChat(nodeId);
    (window as any).__wf_removeNode = (nodeId: string) => removeNode(nodeId);
    return () => {
      delete (window as any).__wf_chatNode;
      delete (window as any).__wf_removeNode;
    };
  }, [nodes]);

  const selectProject = (id: number) => {
    setSelectedProjectId(id);
    const p = projects.find(x => x.id === id);
    if (p) {
      const loadedNodes = (p.nodes as Node[]) || [];
      const loadedEdges = (p.edges as Edge[]) || [];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setCurrentNodes(loadedNodes);
      setCurrentEdges(loadedEdges);
      setFlowMode((p.flowMode as "manual" | "auto") || "manual");
      // Load chats
      fetch(`/api/workflow?chatsFor=${id}`)
        .then(r => r.json())
        .then(c => setProjectChats(c.chats || []))
        .catch(() => setProjectChats([]));
    }
  };

  const createProject = async () => {
    if (!newProject.name.trim()) return;
    const res = await fetch("/api/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newProject, flowMode }),
    });
    const d = await res.json();
    if (d.ok) {
      setNewProject({ name: "", description: "", requirements: "" });
      setShowNewProject(false);
      await fetchAll();
      if (d.project?.id) {
        // Need to re-fetch to get full project
        const pRes = await fetch(`/api/workflow?id=${d.project.id}`).then(r => r.json());
        if (pRes.ok) selectProject(pRes.project.id);
      }
    }
  };

  const runAutoFlow = async () => {
    if (!selectedProjectId) return;
    setAutoProcessing(true);
    try {
      const project = projects.find(p => p.id === selectedProjectId);
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "autoFlow",
          projectId: selectedProjectId,
          requirements: project?.requirements || "",
          projectName: project?.name || "",
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setNodes(d.project.nodes as Node[]);
        setEdges(d.project.edges as Edge[]);
        setCurrentNodes(d.project.nodes as Node[]);
        setCurrentEdges(d.project.edges as Edge[]);
        await fetchAll();
      }
    } finally {
      setAutoProcessing(false);
    }
  };

  const addAgentToCanvas = (agent: any) => {
    const existing = nodes.find(n => (n.data as any)?.agentId === agent.id);
    if (existing) return;
    const x = nodes.length > 0 ? Math.max(...nodes.map(n => n.position.x)) + 300 : 50;
    const y = 100 + Math.floor(Math.random() * 200);
    const newNode: Node = {
      id: `agent-${agent.id}`,
      type: "agentNode",
      position: { x, y },
      data: {
        label: agent.name,
        agentId: agent.id,
        description: agent.description,
        category: agent.name.toLowerCase().replace(" agent", "").replace(" (", ""),
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setCurrentNodes(newNodes);
    setAgentPickerOpen(false);
  };

  const removeNode = (nodeId: string) => {
    const newNodes = nodes.filter(n => n.id !== nodeId);
    const newEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setNodes(newNodes);
    setCurrentNodes(newNodes);
    setEdges(newEdges);
    setCurrentEdges(newEdges);
    if (chatNodeId === nodeId) setChatNodeId(null);
  };

  const saveLayout = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveLayout", projectId: selectedProjectId, nodes: currentNodes, edges: currentEdges }),
      });
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (id: number) => {
    await fetch("/api/workflow", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setNodes([]);
      setEdges([]);
      setProjectChats([]);
    }
    fetchAll();
  };

  const openChat = (nodeId: string | null) => {
    setChatNodeId(nodeId);
    setChatInput("");
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !selectedProjectId) return;
    setChatLoading(true);
    const msg = chatInput.trim();
    const userMsg = { id: Date.now(), role: "user", content: msg, nodeId: chatNodeId };
    setProjectChats(prev => [...prev, userMsg]);
    setChatInput("");

    try {
      const project = projects.find(p => p.id === selectedProjectId);
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          projectId: selectedProjectId,
          nodeId: chatNodeId,
          message: msg,
          projectName: project?.name || "",
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setProjectChats(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: d.response, nodeId: chatNodeId }]);
      }
    } catch (e: any) {
      setProjectChats(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: `ERR: ${e.message}`, nodeId: chatNodeId }]);
    } finally {
      setChatLoading(false);
    }
  };

  const currentProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="hud-alert-box text-sm mb-2">WORKFLOW_ORCHESTRATOR</div>
          <p className="text-xs text-hud-text-dim tracking-wide">Build multi-agent project flows on a live canvas</p>
        </div>
      </div>

      {!selectedProjectId ? (
        // Project List
        <div className="hud-panel hud-bracket p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="hud-data-label">PROJECTS ({projects.length})</div>
            <button onClick={() => setShowNewProject(true)} className="hud-btn-primary px-3 py-2 text-xs flex items-center gap-2">
              <Plus className="w-4 h-4" /> NEW_PROJECT
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: any) => (
              <div key={p.id} className="hud-card hud-bracket">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="hud-data-label">PROJECT_ID :: {p.id.toString().padStart(3, "0")}</div>
                    <div className="text-sm font-bold tracking-wider mt-1">{p.name}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 tracking-widest border ${
                    p.flowMode === "auto" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan/40" : "border-hud-border text-hud-text-dim"
                  }`}>{(p.flowMode || "manual").toUpperCase()}</span>
                </div>
                <p className="text-xs text-hud-text-soft">{p.description || "NO_DESCRIPTION"}</p>
                <div className="text-[10px] font-mono text-hud-text-dim mt-2">
                  NODES: <span className="text-hud-cyan">{(p.nodes as any[])?.length || 0}</span> ·
                  EDGES: <span className="text-hud-cyan">{(p.edges as any[])?.length || 0}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => selectProject(p.id)} className="hud-btn-primary flex-1 px-3 py-1.5 text-xs flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" /> OPEN
                  </button>
                  <button onClick={() => deleteProject(p.id)} className="hud-btn-danger px-2 py-1.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {projects.length === 0 && !loading && (
              <div className="col-span-full text-center py-8 border border-dashed border-hud-border">
                <div className="text-xs text-hud-text-dim tracking-widest">NO_PROJECTS_YET</div>
                <div className="text-[10px] text-hud-text-dim mt-2">Create your first project to start building agent workflows</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Canvas + Chat Layout
        <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 min-h-0">
          {/* Canvas */}
          <div className="hud-panel hud-bracket relative min-h-[500px] h-[calc(100vh-14rem)]">
            <CanvasView
              initialNodes={currentNodes}
              initialEdges={currentEdges}
              onLayoutChange={(n: Node[], e: Edge[]) => {
                setCurrentNodes(n);
                setCurrentEdges(e);
              }}
              flowMode={flowMode}
              onAddAgentClick={() => setAgentPickerOpen(true)}
              onAutoFlowClick={runAutoFlow}
              onClose={() => {
                setSelectedProjectId(null);
                setNodes([]);
                setEdges([]);
                setProjectChats([]);
              }}
              onSaveClick={saveLayout}
              projectName={currentProject?.name || "Project"}
              autoProcessing={autoProcessing}
              saving={saving}
            />
          </div>

          {/* Chat Panel */}
          <div className="hud-panel hud-bracket flex flex-col min-h-0">
            <div className="p-3 border-b border-hud-border">
              <div className="hud-data-label">AGENT_COMMS</div>
              <div className="text-[10px] text-hud-text-dim mt-0.5">
                {chatNodeId
                  ? `TALKING_TO: ${(nodes.find(n => n.id === chatNodeId)?.data as any)?.label || chatNodeId}`
                  : "PROJECT_LEVEL"}
              </div>
              {!chatNodeId && (
                <div className="text-[10px] text-hud-text-dim mt-1">Click CHAT on any agent node to talk</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {projectChats.length === 0 ? (
                <div className="text-[10px] text-hud-text-dim text-center py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-hud-text-dim/30" strokeWidth={1} />
                  <div>NO_MESSAGES</div>
                  <div className="mt-1">Start a conversation with an agent</div>
                </div>
              ) : (
                projectChats.map((m: any) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                    <div className={`max-w-[90%] px-3 py-2 text-[11px] border-l-2 ${
                      m.role === "user"
                        ? "chat-user bg-hud-bg"
                        : "chat-ai bg-hud-panel"
                    }`}>
                      <div className="text-[9px] font-bold tracking-widest opacity-60 mb-0.5">
                        {m.role === "user" ? "OPERATOR" : (m.nodeId ? (nodes.find(n => n.id === m.nodeId)?.data as any)?.label : "PROJECT")}
                      </div>
                      <div className="whitespace-pre-wrap tracking-wide">{m.content}</div>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex">
                  <div className="border-l-2 border-hud-red bg-hud-panel px-3 py-2 text-[11px] flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-hud-red" /> PROCESSING...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-hud-border space-y-2">
              {chatNodeId && (
                <button onClick={() => openChat(null)} className="hud-btn text-[9px] px-2 py-1 flex items-center gap-1 w-full">
                  <X className="w-2.5 h-2.5" /> CLEAR_TARGET ({(nodes.find(n => n.id === chatNodeId)?.data as any)?.label})
                </button>
              )}
              <div className="flex gap-2">
                <input
                  className="hud-input flex-1 px-3 py-2 text-xs"
                  placeholder={chatNodeId ? "> ASK_AGENT..." : "> PROJECT_QUERY..."}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }}
                />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="hud-btn-primary px-3 py-2 text-xs disabled:opacity-40">
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="hud-panel hud-bracket p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="hud-data-label">CREATE_NEW_PROJECT</div>
              <button onClick={() => setShowNewProject(false)} className="hud-btn px-2 py-1 text-[10px]">
                <X className="w-3 h-3" />
              </button>
            </div>

            <div>
              <div className="hud-data-label mb-2">IDENTITY</div>
              <input className="hud-input w-full px-3 py-2" placeholder="PROJECT_NAME" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
              <input className="hud-input w-full mt-2 px-3 py-2" placeholder="DESCRIPTION" value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
            </div>

            <div>
              <div className="hud-data-label mb-2">REQUIREMENTS // PROJECT_DETAILS</div>
              <textarea
                className="hud-input w-full px-3 py-2"
                rows={5}
                placeholder="Describe what this project needs to accomplish. Be specific about tasks, goals, and constraints..."
                value={newProject.requirements}
                onChange={e => setNewProject({ ...newProject, requirements: e.target.value })}
              />
              <div className="text-[10px] text-hud-text-dim mt-1">This will be used for auto agent matching</div>
            </div>

            <div>
              <div className="hud-data-label mb-2">FLOW_MODE</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFlowMode("auto")}
                  className={`hud-btn p-3 flex flex-col items-center gap-2 ${flowMode === "auto" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
                >
                  <Sparkles className="w-6 h-6" strokeWidth={1.5} />
                  <div className="text-xs font-bold tracking-widest">AUTO_FLOW</div>
                  <div className="text-[10px] text-hud-text-dim">Auto-analyze requirements and add matching agents</div>
                </button>
                <button
                  onClick={() => setFlowMode("manual")}
                  className={`hud-btn p-3 flex flex-col items-center gap-2 ${flowMode === "manual" ? "bg-hud-cyan-dim text-hud-cyan border-hud-cyan" : ""}`}
                >
                  <Layout className="w-6 h-6" strokeWidth={1.5} />
                  <div className="text-xs font-bold tracking-widest">MANUAL_FLOW</div>
                  <div className="text-[10px] text-hud-text-dim">Hand-pick agents and build canvas yourself</div>
                </button>
              </div>
            </div>

            <button onClick={createProject} className="hud-btn-primary w-full py-2.5 text-xs">
              CREATE_PROJECT
            </button>
          </div>
        </div>
      )}

      {/* Agent Picker Popup */}
      {agentPickerOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="hud-panel hud-bracket p-6 max-w-xl w-full max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="hud-data-label">ADD_AGENT_TO_CANVAS ({agents.length} AVAILABLE)</div>
              <button onClick={() => setAgentPickerOpen(false)} className="hud-btn px-2 py-1 text-[10px]">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {agents.length === 0 ? (
                <div className="text-center py-8 text-hud-text-dim text-xs">
                  <div>NO_AGENTS_AVAILABLE</div>
                  <div className="text-[10px] mt-1">Create agents in the AGENTS section first</div>
                </div>
              ) : agents.map((a: any) => {
                const added = nodes.some(n => (n.data as any)?.agentId === a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => addAgentToCanvas(a)}
                    disabled={added}
                    className={`hud-btn w-full text-left p-3 flex items-center gap-3 ${added ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="w-8 h-8 border border-hud-cyan/40 bg-hud-cyan-dim flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold tracking-wider truncate">{a.name}</div>
                      <div className="text-[10px] text-hud-text-dim truncate">{a.description || "NO_DESCRIPTION"}</div>
                    </div>
                    <div className="text-[10px]">
                      {added ? (
                        <span className="text-hud-text-dim">✓ ADDED</span>
                      ) : (
                        <Plus className="w-4 h-4 text-hud-cyan" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
