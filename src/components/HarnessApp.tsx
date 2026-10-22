"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HarnessInfo } from "@/lib/types";
import { Badge, Icon, ToastProvider, useToast } from "./ui";
import { ChatView } from "./ChatView";
import { ModelsView } from "./ModelsView";
import { PluginsView } from "./PluginsView";
import { SkillsView } from "./SkillsView";
import { SettingsView } from "./SettingsView";

type ViewId = "chat" | "models" | "plugins" | "skills" | "settings";

const NAV: { id: ViewId; label: string; icon: string; desc: string }[] = [
  { id: "chat", label: "Chat", icon: "chat", desc: "Run the agent with tools, plugins and skills" },
  { id: "models", label: "Models", icon: "cpu", desc: "Installed Ollama models, pull and delete" },
  { id: "plugins", label: "Plugins", icon: "plug", desc: "Toggle tool packs the agent can use" },
  { id: "skills", label: "Skills", icon: "book", desc: "Procedural knowledge injected into prompts" },
  { id: "settings", label: "Settings", icon: "sliders", desc: "Server, sampling, agent loop and workspace" },
];

function Shell() {
  const [info, setInfo] = useState<HarnessInfo | null>(null);
  const [view, setView] = useState<ViewId>("chat");
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const refreshInfo = useCallback(
    async (silent = false) => {
      try {
        const data = await api<HarnessInfo>("/api/harness");
        setInfo(data);
      } catch (e) {
        if (!silent) toast(`Status unavailable: ${(e as Error).message}`, "err");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    refreshInfo();
    const t = setInterval(() => refreshInfo(true), 20000);
    return () => clearInterval(t);
  }, [refreshInfo]);

  const ollama = info?.ollama;
  const activeNav = NAV.find((n) => n.id === view)!;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* sidebar */}
      <aside className="w-56 shrink-0 border-r border-line bg-panel flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-accdim border border-acc/30 grid place-items-center text-acc">
              <Icon name="terminal" className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-none">
                HARNESS
              </div>
              <div className="text-[10px] text-mut mt-1 tracking-[0.14em] uppercase">
                local model agent
              </div>
            </div>
          </div>
        </div>

        <nav className="p-2 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                view === n.id
                  ? "bg-elev text-acc border border-acc/25"
                  : "text-mut hover:text-ink hover:bg-elev border border-transparent"
              }`}
            >
              <Icon name={n.icon} className="w-4 h-4" />
              {n.label}
              {n.id === "skills" && info && (
                <span className="ml-auto text-[10px] font-mono text-dim">
                  {info.skills.filter((s) => s.enabled).length}
                </span>
              )}
              {n.id === "models" && info && (
                <span className="ml-auto text-[10px] font-mono text-dim">
                  {info.ollama.models.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-3">
          <div className="rounded-md border border-line bg-elev px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  ollama?.reachable
                    ? "bg-ok pulse-dot"
                    : "bg-err pulse-dot"
                }`}
              />
              <span className={ollama?.reachable ? "text-ink" : "text-err"}>
                {ollama?.reachable ? "Ollama connected" : "Ollama offline"}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[10.5px] text-mut truncate" title={ollama?.url}>
              {ollama?.url ?? "…"}
            </div>
            {ollama?.reachable && (
              <div className="mt-1 font-mono text-[10.5px] text-dim">
                v{ollama.version ?? "?"} · {ollama.models.length} model
                {ollama.models.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
          <div className="mt-2 px-1 font-mono text-[10px] text-dim truncate" title={info?.workspace}>
            ws: {info?.workspace ?? "—"}
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-line bg-panel/60 backdrop-blur flex items-center px-5 gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-none tracking-tight">
              {activeNav.label}
            </h1>
            <p className="text-[11.5px] text-mut mt-1 truncate">{activeNav.desc}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {ollama && (
              <>
                <Badge tone={ollama.reachable ? "ok" : "err"}>
                  <Icon name="cpu" className="w-3 h-3" />
                  {ollama.reachable
                    ? `Ollama v${ollama.version ?? "?"}`
                    : "Ollama unreachable"}
                </Badge>
                <Badge tone={ollama.models.length ? "acc" : "mut"}>
                  {info?.settings.model || "no model"}
                </Badge>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 min-h-0">
          {loading || !info ? (
            <div className="h-full grid place-items-center">
              <div className="flex flex-col items-center gap-3 text-mut">
                <Icon name="terminal" className="w-6 h-6 text-acc pulse-dot" />
                <div className="text-sm">Connecting to harness…</div>
              </div>
            </div>
          ) : (
            <>
              {view === "chat" && <ChatView info={info} refreshInfo={refreshInfo} />}
              {view === "models" && <ModelsView info={info} refreshInfo={refreshInfo} />}
              {view === "plugins" && <PluginsView info={info} refreshInfo={refreshInfo} />}
              {view === "skills" && <SkillsView info={info} refreshInfo={refreshInfo} />}
              {view === "settings" && <SettingsView info={info} refreshInfo={refreshInfo} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export function HarnessApp() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
