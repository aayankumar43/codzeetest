"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HarnessInfo, Skill } from "@/lib/types";
import { Badge, Button, Card, Field, Icon, Input, Textarea, Toggle, useToast } from "./ui";

interface Draft {
  id: string | null;
  name: string;
  description: string;
  body: string;
  tools: string[];
  builtin: boolean;
}

export function SkillsView({
  info,
  refreshInfo,
}: {
  info: HarnessInfo;
  refreshInfo: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const activeSkills = info.settings.activeSkills;
  const available = new Set(info.availableTools.map((t) => t.name));

  const select = (s: Skill) =>
    setDraft({
      id: s.id,
      name: s.name,
      description: s.description,
      body: s.body,
      tools: s.tools,
      builtin: s.builtin,
    });

  const newSkill = () =>
    setDraft({ id: null, name: "", description: "", body: "", tools: [], builtin: false });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast("Skill name is required", "err");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        body: draft.body,
        tools: draft.tools,
      };
      if (draft.id) {
        await api(`/api/skills/${draft.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast(`Skill '${draft.name}' updated`, "ok");
      } else {
        await api("/api/skills", { method: "POST", body: JSON.stringify(payload) });
        toast(`Skill '${draft.name}' created`, "ok");
      }
      const d = await api<{ skills: Skill[] }>("/api/skills");
      const saved = d.skills.find((s) => s.name === draft.name.trim());
      if (saved) select(saved);
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    try {
      await api(`/api/skills/${draft.id}`, { method: "DELETE" });
      toast(`Skill '${draft.name}' removed`, "ok");
      setDraft(null);
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const setEnabled = async (s: Skill, enabled: boolean) => {
    try {
      await api(`/api/skills/${s.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      if (enabled) {
        const next = new Set([...activeSkills, s.id]);
        await api("/api/settings", {
          method: "PUT",
          body: JSON.stringify({ activeSkills: [...next] }),
        });
      } else {
        const next = activeSkills.filter((id) => id !== s.id);
        await api("/api/settings", {
          method: "PUT",
          body: JSON.stringify({ activeSkills: next }),
        });
      }
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const setInjected = async (s: Skill, on: boolean) => {
    const next = on
      ? Array.from(new Set([...activeSkills, s.id]))
      : activeSkills.filter((id) => id !== s.id);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ activeSkills: next }),
      });
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const selected = draft?.id
    ? info.skills.find((s) => s.id === draft.id) ?? null
    : null;

  return (
    <div className="h-full flex min-h-0">
      {/* list */}
      <div className="w-80 shrink-0 border-r border-line bg-panel/40 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-mut">
            Skills
          </span>
          <Button size="sm" variant="ghost" onClick={newSkill}>
            <Icon name="plus" className="w-3.5 h-3.5" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {info.skills.map((s) => {
            const isSel = draft?.id === s.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  isSel ? "border-line2 bg-elev" : "border-transparent hover:bg-elev/60"
                }`}
                onClick={() => select(s)}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate flex items-center gap-1.5">
                    {s.name}
                    {s.builtin && (
                      <span className="text-[9px] font-mono text-dim border border-line rounded px-1">
                        builtin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-dim truncate">{s.description}</div>
                </div>
                <Toggle
                  checked={s.enabled}
                  disabled={!s.enabled}
                  onChange={() => setEnabled(s, true)}
                  label={`Enable ${s.name}`}
                />
              </div>
            );
          })}
          {info.skills.length === 0 && (
            <div className="text-[12px] text-dim px-2 py-4">No skills yet.</div>
          )}
        </div>
        <div className="p-3 border-t border-line text-[11px] text-dim leading-relaxed">
          Enabled skills marked <b className="text-mut">injected</b> are appended to the system
          prompt of every run.
        </div>
      </div>

      {/* editor */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-2xl mx-auto p-5">
          {!draft && (
            <div className="h-64 grid place-items-center text-mut text-sm border border-dashed border-line rounded-lg">
              Select a skill on the left, or create a new one.
            </div>
          )}
          {draft && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  {draft.id ? "Edit skill" : "New skill"}
                </h2>
                {selected && (
                  <Badge tone={activeSkills.includes(selected.id) ? "acc" : "mut"}>
                    {activeSkills.includes(selected.id) ? "injected into prompts" : "not injected"}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {selected && (
                    <label className="flex items-center gap-2 text-[12px] text-mut">
                      Inject into prompts
                      <Toggle
                        checked={activeSkills.includes(selected.id)}
                        onChange={(v) => setInjected(selected, v)}
                        label="Inject skill"
                      />
                    </label>
                  )}
                  {draft.id && !draft.builtin && (
                    <Button size="sm" variant="danger" onClick={remove}>
                      <Icon name="trash" className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  )}
                  <Button size="sm" variant="primary" onClick={save} disabled={saving}>
                    <Icon name="check" className="w-3.5 h-3.5" />
                    Save
                  </Button>
                </div>
              </div>

              <Field label="Name" hint="Lowercase, hyphens allowed — e.g. csv-auditor">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="my-skill"
                  className="font-mono"
                />
              </Field>
              <Field label="Description">
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="One line on what this skill teaches the agent"
                />
              </Field>
              <Field label="Instructions (markdown)" hint="Appended to the system prompt verbatim when the skill is enabled and injected.">
                <Textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={14}
                  placeholder={"## Workflow\n1. Do X\n2. Verify with Y\n…"}
                />
              </Field>
              <Field label="Tools this skill relies on" hint="Optional reference — skills never grant tools on their own; plugins do.">
                <div className="grid grid-cols-2 gap-1.5">
                  {info.tools.map((t) => {
                    const checked = draft.tools.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            tools: checked
                              ? draft.tools.filter((x) => x !== t.name)
                              : [...draft.tools, t.name],
                          })
                        }
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                          checked
                            ? "border-acc/40 bg-accdim"
                            : "border-line bg-elev/50 hover:border-line2"
                        }`}
                      >
                        <Icon
                          name={checked ? "check" : "plus"}
                          className={`w-3 h-3 ${checked ? "text-acc" : "text-dim"}`}
                        />
                        <span className="font-mono text-[11.5px] truncate">{t.name}</span>
                        {!available.has(t.name) && (
                          <span className="ml-auto text-[9px] font-mono text-warn" title="Plugin disabled">
                            off
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
