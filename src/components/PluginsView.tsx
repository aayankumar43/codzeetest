"use client";

import React from "react";
import { api } from "@/lib/api";
import type { HarnessInfo, PluginInfo } from "@/lib/types";
import { Badge, Button, Card, Icon, Toggle, useToast } from "./ui";

const PLUGIN_ICONS: Record<string, string> = {
  core: "zap",
  filesystem: "folder",
  shell: "terminal",
  memory: "brain",
};

export function PluginsView({
  info,
  refreshInfo,
}: {
  info: HarnessInfo;
  refreshInfo: () => void;
}) {
  const toast = useToast();

  const toggle = async (p: PluginInfo, enabled: boolean) => {
    const next = { ...info.settings.plugins, [p.id]: enabled };
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ plugins: next }) });
      toast(
        `${p.name} ${enabled ? "enabled" : "disabled"} — applies to the next agent run`,
        "ok"
      );
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-5 space-y-4">
        <p className="text-[13px] text-mut max-w-2xl">
          Plugins are tool packs. When a plugin is enabled, its tools are registered with the
          model as callable functions and executed <b>for real</b> on this machine during the
          agent loop. Toggles apply from the next message onward.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {info.plugins.map((p) => {
            const shellLocked = p.id === "shell" && !info.settings.allowShell;
            return (
              <Card key={p.id} className={p.enabled ? "" : "opacity-70"}>
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-md grid place-items-center border shrink-0 ${
                      p.enabled
                        ? "bg-accdim border-acc/30 text-acc"
                        : "bg-elev border-line text-mut"
                    }`}
                  >
                    <Icon name={PLUGIN_ICONS[p.id] ?? "plug"} className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold">{p.name}</span>
                      <Badge tone={p.enabled ? "ok" : "mut"}>
                        {p.enabled ? "active" : "off"}
                      </Badge>
                    </div>
                    <p className="text-[12.5px] text-mut mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                  <Toggle
                    checked={p.enabled && !shellLocked}
                    disabled={shellLocked}
                    onChange={(v) => toggle(p, v)}
                    label={`Toggle ${p.name}`}
                  />
                </div>
                {shellLocked && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-warn bg-warn/5 border border-warn/25 rounded-md px-3 py-2">
                    <Icon name="alert" className="w-3.5 h-3.5" />
                    Shell execution is globally disabled in Settings → Workspace.
                  </div>
                )}
                <div className="mt-4 space-y-1.5">
                  {p.tools.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center gap-2.5 rounded-md border border-line/70 bg-elev/50 px-3 py-2"
                    >
                      <Icon name="wrench" className="w-3.5 h-3.5 text-dim shrink-0" />
                      <span className="font-mono text-[12px] text-ink/90">{t.name}</span>
                      <span className="text-[11.5px] text-dim truncate" title={t.description}>
                        {t.description}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
        <Card title="Available right now">
          <div className="flex flex-wrap gap-1.5">
            {info.availableTools.length === 0 && (
              <span className="text-[13px] text-mut">No tools enabled.</span>
            )}
            {info.availableTools.map((t) => (
              <Badge key={t.name} tone="acc" className="font-mono">
                {t.name}
              </Badge>
            ))}
          </div>
          <div className="mt-3 text-[12px] text-dim">
            {info.availableTools.length} of {info.tools.length} registered tools are exposed to
            the model. The agent can chain up to {info.settings.maxToolSteps} tool steps per
            message.
          </div>
        </Card>
      </div>
    </div>
  );
}
