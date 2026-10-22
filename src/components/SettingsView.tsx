"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HarnessInfo, HarnessSettings } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Input,
  Select,
  Spinner,
  Textarea,
  Toggle,
  useToast,
} from "./ui";

interface Form {
  ollamaUrl: string;
  model: string;
  temperature: string;
  topP: string;
  numCtx: string;
  numPredict: string;
  think: boolean;
  systemPrompt: string;
  maxToolSteps: string;
  contextMessages: string;
  commandTimeoutMs: string;
  maxToolOutputChars: string;
  workspaceDir: string;
  allowShell: boolean;
}

function toForm(s: HarnessSettings): Form {
  return {
    ollamaUrl: s.ollamaUrl,
    model: s.model,
    temperature: String(s.temperature),
    topP: String(s.topP),
    numCtx: String(s.numCtx),
    numPredict: String(s.numPredict),
    think: s.think,
    systemPrompt: s.systemPrompt,
    maxToolSteps: String(s.maxToolSteps),
    contextMessages: String(s.contextMessages),
    commandTimeoutMs: String(s.commandTimeoutMs),
    maxToolOutputChars: String(s.maxToolOutputChars),
    workspaceDir: s.workspaceDir,
    allowShell: s.allowShell,
  };
}

export function SettingsView({
  info,
  refreshInfo,
}: {
  info: HarnessInfo;
  refreshInfo: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Form>(() => toForm(info.settings));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setF(toForm(info.settings));
  }, [info.settings]);

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ollamaUrl: f.ollamaUrl,
          model: f.model.trim(),
          temperature: num(f.temperature, 0.7),
          topP: num(f.topP, 0.9),
          numCtx: num(f.numCtx, 8192),
          numPredict: num(f.numPredict, 2048),
          think: f.think,
          systemPrompt: f.systemPrompt,
          maxToolSteps: num(f.maxToolSteps, 6),
          contextMessages: num(f.contextMessages, 30),
          commandTimeoutMs: num(f.commandTimeoutMs, 25000),
          maxToolOutputChars: num(f.maxToolOutputChars, 12000),
          workspaceDir: f.workspaceDir.trim() || "workspace",
          allowShell: f.allowShell,
        }),
      });
      toast("Settings saved", "ok");
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      const d = await api<{ defaults: HarnessSettings }>("/api/settings");
      await api("/api/settings", { method: "PUT", body: JSON.stringify(d.defaults) });
      setF(toForm(d.defaults));
      toast("Reset to defaults", "ok");
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const test = async () => {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 30));
    // apply the (possibly unsaved) URL first so the test reflects the form
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ ollamaUrl: f.ollamaUrl }),
      });
      const d = await api<HarnessInfo>("/api/harness");
      if (d.ollama.reachable) {
        toast(`Connected to Ollama v${d.ollama.version ?? "?"} — ${d.ollama.models.length} model(s)`, "ok");
      } else {
        toast(d.ollama.error ?? "Cannot reach Ollama", "err");
      }
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setTesting(false);
    }
  };

  const numInput = (
    key: keyof Form,
    step = 1,
    min?: number,
    max?: number,
    suffix?: string
  ) => (
    <div className="relative">
      <Input
        type="number"
        value={f[key] as string}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="font-mono pr-10"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] text-dim font-mono">
          {suffix}
        </span>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-5 space-y-4 pb-24">
        <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur flex items-center justify-end gap-2 py-2">
          <Button variant="ghost" onClick={reset}>
            Reset to defaults
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4" /> : <Icon name="check" className="w-4 h-4" />}
            Save settings
          </Button>
        </div>

        <Card
          title="Ollama server"
          right={
            <Button size="sm" variant="outline" onClick={test} disabled={testing}>
              {testing ? <Spinner className="w-3.5 h-3.5" /> : <Icon name="zap" className="w-3.5 h-3.5" />}
              Test connection
            </Button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Server URL" hint="Where ollama serve is listening. Use a LAN address if Ollama runs on another machine.">
              <Input
                value={f.ollamaUrl}
                onChange={(e) => setF({ ...f, ollamaUrl: e.target.value })}
                className="font-mono"
                placeholder="http://localhost:11434"
              />
            </Field>
            <Field label="Default model" hint="Any installed model name. Can be overridden per conversation in Chat.">
              <Input
                value={f.model}
                onChange={(e) => setF({ ...f, model: e.target.value })}
                className="font-mono"
                list="models-dl"
              />
              <datalist id="models-dl">
                {info.ollama.models.map((m) => (
                  <option key={m.name} value={m.name} />
                ))}
              </datalist>
            </Field>
          </div>
        </Card>

        <Card title="Sampling & generation">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Temperature" hint="0 = deterministic, 1+ = creative">
              {numInput("temperature", 0.1, 0, 2)}
            </Field>
            <Field label="Top-p" hint="Nucleus sampling">
              {numInput("topP", 0.05, 0, 1)}
            </Field>
            <Field label="Context window" hint="num_ctx tokens">
              {numInput("numCtx", 1024, 256, 262144, "tok")}
            </Field>
            <Field label="Max tokens" hint="-1 = unlimited">
              {numInput("numPredict", 128, -1, 32768, "tok")}
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-3 text-[13px]">
            <Toggle checked={f.think} onChange={(v) => setF({ ...f, think: v })} label="Thinking" />
            <span className="font-medium">Enable thinking</span>
            <span className="text-mut text-[12px]">
              Sends <code className="font-mono text-[11px]">think: true</code> — only used by
              thinking-capable models (e.g. deepseek-r1, qwen3).
            </span>
          </label>
        </Card>

        <Card title="Agent loop">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Max tool steps" hint="Tool-call rounds per message">
              {numInput("maxToolSteps", 1, 1, 30)}
            </Field>
            <Field label="Context messages" hint="Past messages sent to the model">
              {numInput("contextMessages", 2, 4, 200)}
            </Field>
            <Field label="Command timeout" hint="Per shell command">
              {numInput("commandTimeoutMs", 1000, 1000, 300000, "ms")}
            </Field>
            <Field label="Max tool output" hint="Result cap per tool call">
              {numInput("maxToolOutputChars", 500, 500, 200000, "ch")}
            </Field>
          </div>
        </Card>

        <Card title="Workspace & shell">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Workspace directory" hint="File tools and bash commands operate here. Relative paths resolve against the app root.">
              <Input
                value={f.workspaceDir}
                onChange={(e) => setF({ ...f, workspaceDir: e.target.value })}
                className="font-mono"
                placeholder="workspace"
              />
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-3 text-[13px] w-full bg-elev/60 border border-line rounded-md px-3 py-2.5">
                <Toggle
                  checked={f.allowShell}
                  onChange={(v) => setF({ ...f, allowShell: v })}
                  label="Allow shell"
                />
                <span className="font-medium">Allow shell execution</span>
              </label>
            </div>
          </div>
          {f.allowShell && (
            <div className="mt-3 flex items-start gap-2.5 rounded-md border border-warn/30 bg-warn/5 px-3.5 py-2.5 text-[12.5px] text-warn">
              <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The model can execute real commands on this machine (capped at{" "}
                {f.commandTimeoutMs} ms each, working dir restricted to the workspace). Use in a
                container or sandbox you can afford to lose.
              </span>
            </div>
          )}
        </Card>

        <Card title="System prompt">
          <Field label="Base instructions" hint="Plugin notes, active skills and the environment block are appended automatically.">
            <Textarea
              value={f.systemPrompt}
              onChange={(e) => setF({ ...f, systemPrompt: e.target.value })}
              rows={7}
            />
          </Field>
        </Card>

        <div className="flex items-center gap-2 text-[12px] text-dim">
          <Badge tone="mut">
            <Icon name="database" className="w-3 h-3" />
            state in PostgreSQL
          </Badge>
          <Badge tone="mut">
            <Icon name="terminal" className="w-3 h-3" />
            tools executed on the host
          </Badge>
          <span>Changes apply to new agent runs immediately.</span>
        </div>
      </div>
    </div>
  );
}
