"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Triangle, Activity, PanelLeftOpen, PanelLeftClose } from "lucide-react";

const nav = [
  { href: "/", label: "OVERVIEW", code: "01" },
  { href: "/models", label: "MODELS", code: "02" },
  { href: "/tools", label: "TOOLS", code: "03" },
  { href: "/plugins", label: "PLUGINS", code: "04" },
  { href: "/skills", label: "SKILLS", code: "05" },
  { href: "/agents", label: "AGENTS", code: "06" },
  { href: "/workflow", label: "WORKFLOW", code: "07" },
  { href: "/mcp", label: "MCP_LINKS", code: "08" },
  { href: "/chat", label: "COMMS", code: "09" },
  { href: "/settings", label: "CONFIG", code: "10" },
];

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [time, setTime] = useState("");
  const [open, setOpen] = useState(true);

  // Load persisted state
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("harness_sidebar_state");
      if (stored !== null) setOpen(stored === "open");
    } catch {}
  }, []);

  // Persist state
  useEffect(() => {
    try {
      window.localStorage.setItem("harness_sidebar_state", open ? "open" : "closed");
    } catch {}
  }, [open]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex bg-hud-bg text-hud-text relative">
      {/* Toggle button - visible in both states */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-4 z-50 hud-btn-primary p-2 transition-all duration-300 ${
          open
            ? "left-[calc(16rem+1rem)]"
            : "left-4"
        }`}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        title={open ? "HIDE_PANEL" : "SHOW_PANEL"}
      >
        {open ? (
          <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
        ) : (
          <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
        )}
      </button>

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col border-r border-hud-border bg-hud-bg/95 backdrop-blur transition-all duration-300 ease-out overflow-hidden ${
          open ? "w-64 translate-x-0" : "w-64 -translate-x-full"
        }`}
      >
        {/* Top Section with Triangle Logo */}
        <div className="p-5 pt-5 border-b border-hud-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Triangle className="w-8 h-8 text-hud-text" strokeWidth={1} fill="none" />
            </div>
            <div className="min-w-0">
              <div className="hud-refcode">/SYS:</div>
              <h1 className="text-xs font-bold tracking-widest text-hud-text">OLLAMA_HARNESS</h1>
              <div className="text-[10px] text-hud-text-dim mt-0.5">v2.1 // LOCAL</div>
            </div>
          </div>
          <div className="hud-refcode">
            <div>DB.887</div>
            <div>1_007_TAB</div>
            <div>986_DE</div>
          </div>
        </div>

        {/* NAV */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-5 py-2.5 text-xs tracking-widest transition-all ${
                  active
                    ? "text-hud-cyan-bright bg-hud-cyan-dim/50 border-l-2 border-hud-cyan-bright"
                    : "text-hud-text-soft hover:text-hud-text hover:bg-white/[0.02]"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-hud-text-dim">{item.code}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Status */}
        <div className="p-4 border-t border-hud-border">
          <div className="hud-refcode mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-hud-green" />
              <span className="text-hud-text-soft">SYS_OPERATIONAL</span>
            </div>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-hud-text-dim">TIME</span>
            <span className="text-hud-text-soft font-mono">{time}</span>
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-hud-text-dim">MODE</span>
            <span className="text-hud-green">ACTIVE</span>
          </div>
        </div>
      </aside>

      {/* Spacer for open sidebar */}
      <div className={`shrink-0 transition-all duration-300 ease-out ${open ? "w-64" : "w-0"}`} />

      {/* MAIN */}
      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        <div className={`max-w-[1600px] mx-auto px-8 py-6 transition-all duration-300 ${open ? "" : "pl-8"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
