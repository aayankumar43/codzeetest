"use client";
import { useEffect, useState } from "react";
import { Cpu, BrainCircuit, Wrench, Puzzle, Server, Bot } from "lucide-react";

export default function MemoryNexus() {
  const [stats, setStats] = useState({
    models: 0,
    tools: 0,
    plugins: 0,
    skills: 0,
    agents: 0,
    mcp: 0,
    messages: 0,
    conversations: 0,
    toolExecutions: 0,
    ollama: false,
    omniroute: false,
    openrouter: false,
  });
  const [rotation, setRotation] = useState(0);
  const [scanAngle, setScanAngle] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(d => setStats(s => ({ ...s, models: d.models?.length || 0 })));
    fetch("/api/tools").then(r => r.json()).then(d => setStats(s => ({ ...s, tools: d.tools?.length || 0 })));
    fetch("/api/plugins").then(r => r.json()).then(d => setStats(s => ({ ...s, plugins: d.plugins?.length || 0 })));
    fetch("/api/skills").then(r => r.json()).then(d => setStats(s => ({ ...s, skills: d.skills?.length || 0 })));
    fetch("/api/agents").then(r => r.json()).then(d => setStats(s => ({ ...s, agents: d.agents?.length || 0 })));
    fetch("/api/mcp").then(r => r.json()).then(d => setStats(s => ({ ...s, mcp: d.servers?.length || 0 })));
    fetch("/api/ollama/status").then(r => r.json()).then(d => setStats(s => ({ ...s, ollama: d.ollamaConnected || false })));
    fetch("/api/omniroute/status").then(r => r.json()).then(d => setStats(s => ({ ...s, omniroute: d.omnirouteConnected || false })));
    fetch("/api/openrouter/status").then(r => r.json()).then(d => setStats(s => ({ ...s, openrouter: d.openrouterConnected || false })));

    const anim = setInterval(() => {
      setRotation(r => (r + 0.4) % 360);
      setScanAngle(a => (a + 2.5) % 360);
      setPulsePhase(p => (p + 0.08) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(anim);
  }, []);

  const totalMemory = stats.models + stats.tools + stats.plugins + stats.skills + stats.agents + stats.mcp;
  const memoryPercent = Math.min(100, totalMemory * 10);

  const pulseOpacity = 0.4 + Math.sin(pulsePhase) * 0.3;

  // 7 orbital nodes at ~51.4° intervals
  const outerNodes = [
    { label: "MODELS", value: stats.models, angle: 0, icon: Cpu, color: "#e8f0f6" },
    { label: "SKILLS", value: stats.skills, angle: 52, icon: BrainCircuit, color: "#e8f0f6" },
    { label: "PLUGINS", value: stats.plugins, angle: 103, icon: Puzzle, color: "#e8f0f6" },
    { label: "AGENTS", value: stats.agents, angle: 154, icon: Bot, color: "#e8f0f6" },
    { label: "TOOLS", value: stats.tools, angle: 206, icon: Wrench, color: "#e8f0f6" },
    { label: "MCP", value: stats.mcp, angle: 257, icon: Server, color: "#e8f0f6" },
    { label: "ENGINES", value: (stats.ollama ? 1 : 0) + (stats.omniroute ? 1 : 0) + (stats.openrouter ? 1 : 0), angle: 309, icon: Cpu, color: "#e8f0f6" },
  ];

  return (
    <div className="hud-panel hud-bracket p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="hud-data-label mb-1">MEMORY_NEXUS</div>
          <div className="text-xs text-hud-text-dim tracking-wider">// COGNITIVE_TOPOLOGY_MAP</div>
        </div>
        <div className="hud-refcode text-right">
          <div>NODES: {totalMemory.toString().padStart(3, "0")}</div>
          <div>LINKS: {(totalMemory * 2).toString().padStart(3, "0")}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-center">
        {/* SVG Nexus Visualization */}
        <div className="aspect-square max-w-[380px] mx-auto relative">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e8f0f6" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#c8dce8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#c8dce8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e8f0f6" stopOpacity="1" />
                <stop offset="70%" stopColor="#c8dce8" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#c8dce8" stopOpacity="0" />
              </radialGradient>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background circles */}
            <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(140,190,220,0.06)" strokeWidth="1" />

            {/* Outer ring (rotating) */}
            <circle
              cx="200"
              cy="200"
              r="160"
              fill="none"
              stroke="rgba(140,190,220,0.18)"
              strokeWidth="1"
              strokeDasharray="2 6"
              transform={`rotate(${rotation} 200 200)`}
            />

            {/* Middle ring */}
            <circle
              cx="200"
              cy="200"
              r="120"
              fill="none"
              stroke="rgba(140,190,220,0.25)"
              strokeWidth="1"
              strokeDasharray="1 3"
              transform={`rotate(${-rotation * 0.6} 200 200)`}
            />

            {/* Inner ring */}
            <circle
              cx="200"
              cy="200"
              r="70"
              fill="none"
              stroke="rgba(140,190,220,0.35)"
              strokeWidth="1"
            />

            {/* Cross hairs */}
            <line x1="200" y1="20" x2="200" y2="380" stroke="rgba(140,190,220,0.15)" strokeWidth="0.5" />
            <line x1="20" y1="200" x2="380" y2="200" stroke="rgba(140,190,220,0.15)" strokeWidth="0.5" />

            {/* Diagonal cross */}
            <line x1="70" y1="70" x2="330" y2="330" stroke="rgba(140,190,220,0.08)" strokeWidth="0.5" />
            <line x1="330" y1="70" x2="70" y2="330" stroke="rgba(140,190,220,0.08)" strokeWidth="0.5" />

            {/* Scan sweep */}
            <line
              x1="200"
              y1="200"
              x2={200 + 180 * Math.cos((scanAngle * Math.PI) / 180)}
              y2={200 + 180 * Math.sin((scanAngle * Math.PI) / 180)}
              stroke="#e8f0f6"
              strokeWidth="1"
              opacity="0.6"
              filter="url(#softGlow)"
            />

            {/* Connection lines to nodes */}
            {outerNodes.map((node, i) => {
              const rad = (node.angle * Math.PI) / 180;
              const x = 200 + 160 * Math.cos(rad);
              const y = 200 + 160 * Math.sin(rad);
              return (
                <line
                  key={`line-${i}`}
                  x1="200"
                  y1="200"
                  x2={x}
                  y2={y}
                  stroke="rgba(232,240,246,0.25)"
                  strokeWidth="0.5"
                  strokeDasharray="3 2"
                />
              );
            })}

            {/* Center glow */}
            <circle cx="200" cy="200" r="30" fill="url(#centerGlow)" />
            <circle
              cx="200"
              cy="200"
              r="18"
              fill="none"
              stroke="#e8f0f6"
              strokeWidth="1.5"
              filter="url(#softGlow)"
            />
            <circle
              cx="200"
              cy="200"
              r="6"
              fill="#e8f0f6"
              opacity={pulseOpacity}
            />

            {/* Center label */}
            <text x="200" y="245" textAnchor="middle" className="text-[9px]" fill="rgba(232,240,246,0.7)" fontFamily="JetBrains Mono">
              NEXUS_CORE
            </text>
            <text x="200" y="257" textAnchor="middle" className="text-[8px]" fill="rgba(93,110,126,0.8)" fontFamily="JetBrains Mono">
              v{totalMemory.toString().padStart(3, "0")}
            </text>

            {/* Orbital nodes */}
            {outerNodes.map((node, i) => {
              const rad = (node.angle * Math.PI) / 180;
              const x = 200 + 160 * Math.cos(rad);
              const y = 200 + 160 * Math.sin(rad);
              const isHot = node.value > 0;
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="14"
                    fill={isHot ? "rgba(232,240,246,0.12)" : "rgba(10,15,26,0.8)"}
                    stroke={isHot ? "#e8f0f6" : "rgba(140,190,220,0.3)"}
                    strokeWidth="1"
                  />
                  {isHot && (
                    <circle
                      cx={x}
                      cy={y}
                      r="20"
                      fill="none"
                      stroke="#e8f0f6"
                      strokeWidth="0.5"
                      opacity={0.3 + Math.sin(pulsePhase + i) * 0.2}
                    />
                  )}
                  <text
                    x={x}
                    y={y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[10px]"
                    fill={isHot ? "#e8f0f6" : "#5d6e7e"}
                    fontWeight="700"
                    fontFamily="JetBrains Mono"
                  >
                    {node.value.toString().padStart(2, "0")}
                  </text>
                  <text
                    x={x}
                    y={y - 22}
                    textAnchor="middle"
                    className="text-[7px]"
                    fill="rgba(93,110,126,0.9)"
                    fontFamily="JetBrains Mono"
                    letterSpacing="0.1em"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Cardinal labels */}
            <text x="200" y="15" textAnchor="middle" className="text-[7px]" fill="#5d6e7e" fontFamily="JetBrains Mono" letterSpacing="0.2em">
              N
            </text>
            <text x="390" y="204" textAnchor="middle" className="text-[7px]" fill="#5d6e7e" fontFamily="JetBrains Mono" letterSpacing="0.2em">
              E
            </text>
            <text x="200" y="395" textAnchor="middle" className="text-[7px]" fill="#5d6e7e" fontFamily="JetBrains Mono" letterSpacing="0.2em">
              S
            </text>
            <text x="10" y="204" textAnchor="middle" className="text-[7px]" fill="#5d6e7e" fontFamily="JetBrains Mono" letterSpacing="0.2em">
              W
            </text>

            {/* Corner brackets */}
            <path d="M 30 30 L 30 45 M 30 30 L 45 30" fill="none" stroke="rgba(140,190,220,0.4)" strokeWidth="1" />
            <path d="M 370 30 L 370 45 M 370 30 L 355 30" fill="none" stroke="rgba(140,190,220,0.4)" strokeWidth="1" />
            <path d="M 30 370 L 30 355 M 30 370 L 45 370" fill="none" stroke="rgba(140,190,220,0.4)" strokeWidth="1" />
            <path d="M 370 370 L 370 355 M 370 370 L 355 370" fill="none" stroke="rgba(140,190,220,0.4)" strokeWidth="1" />
          </svg>

          {/* Coordinate overlay */}
          <div className="absolute top-3 left-3 hud-refcode">
            <div>/C:</div>
            <div>DB.{String(887 + stats.models).padStart(3, "0")}</div>
            <div>1_007_TAB</div>
          </div>
          <div className="absolute top-3 right-3 hud-refcode text-right">
            <div>L{String(stats.tools + stats.skills).padStart(3, "0")}.{String(stats.mcp).padStart(3, "0")}</div>
            <div>A{String(61 + stats.plugins).padStart(3, "0")}</div>
          </div>
        </div>

        {/* Side Stats Panel */}
        <div className="space-y-3">
          <div className="border-l-2 border-hud-text/30 pl-3 py-1">
            <div className="hud-data-label">ACTIVE_NODES</div>
            <div className="text-xl font-bold tracking-widest text-hud-text mt-0.5">
              {totalMemory.toString().padStart(3, "0")}
            </div>
          </div>

          <div className="border-l-2 border-hud-text/30 pl-3 py-1">
            <div className="hud-data-label">NEURAL_LOAD</div>
            <div className="text-xl font-bold tracking-widest text-hud-text mt-0.5">
              {memoryPercent.toString().padStart(3, "0")}%
            </div>
            <div className="mt-1 h-1 w-full bg-hud-bg border border-hud-border">
              <div
                className="h-full bg-hud-text transition-all"
                style={{ width: `${memoryPercent}%` }}
              />
            </div>
          </div>

          <div className="border-l-2 border-hud-text/30 pl-3 py-1">
            <div className="hud-data-label">STATUS</div>
            <div className={`text-xs font-bold tracking-widest mt-0.5 ${
              totalMemory > 0 ? "hud-status-online" : "hud-status-offline"
            }`}>
              {totalMemory > 0 ? "● OPERATIONAL" : "● IDLE"}
            </div>
          </div>

          <div className="border-l-2 border-hud-red/40 pl-3 py-1">
            <div className="hud-data-label">SCAN_CYCLE</div>
            <div className="text-xs font-bold tracking-widest text-hud-text mt-0.5 font-mono">
              {scanAngle.toFixed(1).padStart(5, "0")}°
            </div>
          </div>

          <div className="mt-3 p-3 border border-hud-border bg-hud-bg/50">
            <div className="hud-data-label mb-2">LAYER_BREAKDOWN</div>
            <div className="space-y-1 text-[10px]">
              {[
                { label: "LLM_ENGINES", value: (stats.ollama ? 1 : 0) + (stats.omniroute ? 1 : 0) + (stats.openrouter ? 1 : 0), color: stats.ollama || stats.omniroute || stats.openrouter ? "hud-status-online" : "hud-status-offline" },
              { label: "OPENROUTER", value: stats.openrouter ? 1 : 0, color: stats.openrouter ? "hud-status-online" : "hud-status-offline" },
                { label: "MODELS", value: stats.models, color: stats.models > 0 ? "text-hud-text" : "text-hud-text-dim" },
                { label: "SKILLS", value: stats.skills, color: stats.skills > 0 ? "text-hud-text" : "text-hud-text-dim" },
                { label: "AGENTS", value: stats.agents, color: stats.agents > 0 ? "text-hud-text" : "text-hud-text-dim" },
                { label: "TOOLS", value: stats.tools, color: stats.tools > 0 ? "text-hud-text" : "text-hud-text-dim" },
                { label: "PLUGINS", value: stats.plugins, color: stats.plugins > 0 ? "text-hud-text" : "text-hud-text-dim" },
                { label: "MCP_LINKS", value: stats.mcp, color: stats.mcp > 0 ? "text-hud-text" : "text-hud-text-dim" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="tracking-wider text-hud-text-soft">{r.label}</span>
                  <span className={`font-bold tracking-widest ${r.color}`}>{r.value.toString().padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
