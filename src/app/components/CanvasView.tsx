"use client";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Bot,
  Plus,
  Trash2,
  MessageSquare,
  GitBranch,
  Sparkles,
  Save,
  X,
} from "lucide-react";

// Custom Agent Node
function AgentNode({ data, id }: NodeProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="hud-card hud-bracket w-[240px]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Handle type="target" position={Position.Top} className="!bg-hud-cyan !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 border border-hud-cyan/40 bg-hud-cyan-dim flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold tracking-wider text-hud-text truncate">{data.label || "Agent"}</div>
          <div className="text-[9px] text-hud-text-dim font-mono">AGENT_{String(data.agentId || 0).padStart(3, "0")}</div>
        </div>
      </div>
      {hover && data.description && (
        <div className="text-[10px] text-hud-text-soft leading-tight mb-2">{data.description}</div>
      )}
      <div className="flex items-center gap-1 mb-2">
        <span className="w-1.5 h-1.5 bg-hud-green" />
        <span className="text-[9px] text-hud-text-dim tracking-widest">{data.category || "AGENT"}</span>
      </div>
      {hover && (
        <div className="flex gap-1 pt-1 border-t border-hud-border">
          <button
            className="hud-btn-primary flex-1 px-1 py-0.5 text-[9px] flex items-center justify-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              const fn = (window as any).__wf_chatNode;
              if (typeof fn === "function") fn(id);
            }}
          >
            <MessageSquare className="w-2.5 h-2.5" /> CHAT
          </button>
          <button
            className="hud-btn-danger px-1 py-0.5 text-[9px]"
            onClick={(e) => {
              e.stopPropagation();
              const fn = (window as any).__wf_removeNode;
              if (typeof fn === "function") fn(id);
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-hud-cyan !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };

interface CanvasViewProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onLayoutChange: (nodes: Node[], edges: Edge[]) => void;
  flowMode: "manual" | "auto";
  onAddAgentClick: () => void;
  onAutoFlowClick: () => void;
  onClose: () => void;
  onSaveClick: () => void;
  projectName: string;
  autoProcessing?: boolean;
  saving?: boolean;
}

export default function CanvasView({
  initialNodes,
  initialEdges,
  onLayoutChange,
  flowMode,
  onAddAgentClick,
  onAutoFlowClick,
  onClose,
  onSaveClick,
  projectName,
  autoProcessing,
  saving,
}: CanvasViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [syncKey, setSyncKey] = useState(0);

  // Sync when parent changes initial nodes/edges (e.g., after auto-flow)
  useEffect(() => {
    if (syncKey === 0) return; // skip initial mount
    setNodes(initialNodes);
    setEdges(initialEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  // Track changes and report back
  useEffect(() => {
    if (syncKey > 0) {
      onLayoutChange(nodes, edges);
    }
  }, [nodes, edges, syncKey, onLayoutChange]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge({ ...params, type: "smoothstep", animated: true, style: { stroke: "#c8dce8" } }, eds)
    );
  }, [setEdges]);

  // Trigger sync when parent passes new initialNodes/initialEdges
  const parentNodesStr = JSON.stringify(initialNodes);
  const parentEdgesStr = JSON.stringify(initialEdges);
  useEffect(() => {
    setSyncKey((k) => k + 1);
  }, [parentNodesStr, parentEdgesStr]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[60%] pointer-events-none">
        <div className="hud-data-label bg-hud-bg/90 px-2 py-1 rounded">CANVAS: {projectName}</div>
        <div className="text-[10px] text-hud-text-dim font-mono bg-hud-bg/90 px-2 py-1 rounded">
          NODES: {nodes.length} · EDGES: {edges.length}
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10 flex gap-2 flex-wrap">
        {flowMode === "manual" && (
          <button onClick={onAddAgentClick} className="hud-btn px-3 py-1.5 text-xs flex items-center gap-1">
            <Plus className="w-3 h-3" /> ADD_AGENT
          </button>
        )}
        {flowMode === "auto" && (
          <button onClick={onAutoFlowClick} disabled={autoProcessing} className="hud-btn px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-50">
            <Sparkles className="w-3 h-3" /> {autoProcessing ? "ANALYZING..." : "RE-RUN_AUTO"}
          </button>
        )}
        <button onClick={onSaveClick} className="hud-btn px-3 py-1.5 text-xs flex items-center gap-1">
          <Save className="w-3 h-3" /> {saving ? "SAVING..." : "SAVE"}
        </button>
        <button onClick={onClose} className="hud-btn-danger px-3 py-1.5 text-xs flex items-center gap-1">
          <X className="w-3 h-3" /> CLOSE
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-hud-bg"
        style={{ width: "100%", height: "100%" }}
      >
        <Background color="rgba(140,190,220,0.05)" gap={24} />
        <Controls className="!bg-hud-bg !border-hud-border" />
        <MiniMap
          nodeColor={() => "#c8dce8"}
          maskColor="rgba(5,8,16,0.9)"
          className="!bg-hud-bg !border-hud-border"
        />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="hud-panel hud-bracket p-8 text-center pointer-events-auto">
            <GitBranch className="w-12 h-12 mx-auto mb-3 text-hud-text-dim" strokeWidth={1} />
            <div className="text-sm font-bold tracking-widest text-hud-text">CANVAS_EMPTY</div>
            <div className="text-[11px] text-hud-text-dim mt-2 tracking-wide">
              {flowMode === "auto"
                ? "Click RE-RUN_AUTO to auto-generate agents from requirements"
                : "Click ADD_AGENT to place agents on the canvas"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
