"use client";

import React, { useRef, useState } from "react";
import { api, formatBytes } from "@/lib/api";
import type { HarnessInfo, ModelInfo } from "@/lib/types";
import { Badge, Button, Card, Icon, Input, Spinner, useToast } from "./ui";

interface PullState {
  name: string;
  status: string;
  completed?: number;
  total?: number;
  done?: boolean;
  error?: string;
}

export function ModelsView({
  info,
  refreshInfo,
}: {
  info: HarnessInfo;
  refreshInfo: () => void;
}) {
  const toast = useToast();
  const [pullName, setPullName] = useState("");
  const [pull, setPull] = useState<PullState | null>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const doPull = async () => {
    const name = pullName.trim();
    if (!name) return;
    setPull({ name, status: "starting…" });
    try {
      const res = await fetch("/api/ollama/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setPull({ name, status: "failed", error: d.error ?? `HTTP ${res.status}` });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (!mountedRef.current) return;
          if (ev.type === "progress") {
            setPull({
              name,
              status: (ev.status as string) ?? "pulling",
              completed: ev.completed as number | undefined,
              total: ev.total as number | undefined,
            });
          } else if (ev.type === "done") {
            setPull({ name, status: "success", done: true });
            toast(`Pulled ${name}`, "ok");
            refreshInfo();
            setTimeout(() => mountedRef.current && setPull(null), 2500);
          } else if (ev.type === "error") {
            setPull({ name, status: "failed", error: ev.message as string });
            toast(`Pull failed: ${ev.message}`, "err");
          }
        }
      }
    } catch (e) {
      if (mountedRef.current)
        setPull({ name, status: "failed", error: (e as Error).message });
    }
  };

  const setDefault = async (name: string) => {
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ model: name }),
      });
      toast(`Default model → ${name}`, "ok");
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const doDelete = async (name: string) => {
    setDelConfirm(null);
    try {
      await api("/api/ollama/models", {
        method: "DELETE",
        body: JSON.stringify({ name }),
      });
      toast(`Deleted ${name}`, "ok");
      refreshInfo();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const { ollama } = info;
  const pct =
    pull && pull.total && pull.total > 0 && pull.completed
      ? Math.min(100, Math.round((pull.completed / pull.total) * 100))
      : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-5 space-y-4">
        {/* server status */}
        <Card
          title="Ollama server"
          right={
            <Button size="sm" variant="ghost" onClick={refreshInfo}>
              <Icon name="refresh" className="w-3.5 h-3.5" />
              Refresh
            </Button>
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-[11px] text-mut mb-0.5">endpoint</div>
              <div className="font-mono text-[13px]">{ollama.url}</div>
            </div>
            <div>
              <div className="text-[11px] text-mut mb-0.5">status</div>
              {ollama.reachable ? (
                <Badge tone="ok">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block" />
                  v{ollama.version ?? "?"} · running
                </Badge>
              ) : (
                <Badge tone="err">unreachable</Badge>
              )}
            </div>
            <div>
              <div className="text-[11px] text-mut mb-0.5">installed</div>
              <div className="font-mono text-[13px]">{ollama.models.length}</div>
            </div>
            <div>
              <div className="text-[11px] text-mut mb-0.5">loaded in RAM</div>
              <div className="font-mono text-[13px]">{ollama.loaded.length}</div>
            </div>
            <div className="ml-auto">
              <div className="text-[11px] text-mut mb-1">default model</div>
              <Badge tone="acc">{info.settings.model}</Badge>
            </div>
          </div>
          {!ollama.reachable && (
            <div className="mt-4 rounded-md border border-warn/30 bg-warn/5 p-3.5 text-[13px]">
              <div className="font-semibold text-warn flex items-center gap-2 mb-2">
                <Icon name="alert" className="w-4 h-4" />
                Ollama is not reachable
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-ink/80">
                <li>
                  Install it on the machine running this app:{" "}
                  <code className="font-mono text-[12px] bg-elev px-1.5 py-0.5 rounded border border-line">
                    curl -fsSL https://ollama.com/install.sh | sh
                  </code>{" "}
                  (or use the desktop app)
                </li>
                <li>
                  Make sure it is running:{" "}
                  <code className="font-mono text-[12px] bg-elev px-1.5 py-0.5 rounded border border-line">
                    ollama serve
                  </code>
                </li>
                <li>
                  Pull a model:{" "}
                  <code className="font-mono text-[12px] bg-elev px-1.5 py-0.5 rounded border border-line">
                    ollama pull llama3.2
                  </code>
                </li>
                <li>
                  If Ollama runs on another host or port, change the endpoint under{" "}
                  <b>Settings</b>.
                </li>
              </ol>
            </div>
          )}
        </Card>

        {/* pull */}
        <Card title="Pull a model">
          <div className="flex gap-2">
            <Input
              value={pullName}
              onChange={(e) => setPullName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !pull && doPull()}
              placeholder="e.g. llama3.2, qwen2.5:7b, mistral-nemo, phi3.5"
              className="font-mono"
              disabled={!!pull}
            />
            <Button variant="primary" onClick={doPull} disabled={!!pull || !pullName.trim()}>
              <Icon name="download" className="w-4 h-4" />
              Pull
            </Button>
          </div>
          {pull && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-[12.5px] font-mono">
                {!pull.done && !pull.error && <Spinner className="w-3.5 h-3.5 text-acc" />}
                <span className={pull.error ? "text-err" : pull.done ? "text-ok" : "text-mut"}>
                  {pull.error
                    ? `failed — ${pull.error}`
                    : pull.done
                      ? `${pull.name} ready`
                      : `${pull.name} · ${pull.status}`}
                </span>
                {pct !== null && (
                  <span className="ml-auto text-dim">
                    {formatBytes(pull.completed ?? 0)} / {formatBytes(pull.total ?? 0)} · {pct}%
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-elev overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${pull.error ? "bg-err" : "bg-acc"}`}
                  style={{ width: pct !== null ? `${pct}%` : pull.done ? "100%" : "8%" }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* installed */}
        <Card title={`Installed models (${ollama.models.length})`} pad={false}>
          {ollama.models.length === 0 ? (
            <div className="p-6 text-center text-mut text-sm">
              {ollama.reachable
                ? "No models installed yet — pull one above."
                : "Connect to Ollama to see installed models."}
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">name</th>
                  <th className="px-3 py-2.5 font-semibold">family</th>
                  <th className="px-3 py-2.5 font-semibold">params</th>
                  <th className="px-3 py-2.5 font-semibold">size</th>
                  <th className="px-3 py-2.5 font-semibold">status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">actions</th>
                </tr>
              </thead>
              <tbody>
                {ollama.models.map((m: ModelInfo) => (
                  <ModelRow
                    key={m.name}
                    m={m}
                    isDefault={m.name === info.settings.model}
                    loaded={ollama.loaded.some((l) => l.name === m.name)}
                    confirming={delConfirm === m.name}
                    onArm={() => setDelConfirm(m.name)}
                    onDisarm={() => setDelConfirm(null)}
                    onSetDefault={() => setDefault(m.name)}
                    onDelete={() => doDelete(m.name)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

function ModelRow({
  m,
  isDefault,
  loaded,
  confirming,
  onArm,
  onDisarm,
  onSetDefault,
  onDelete,
}: {
  m: ModelInfo;
  isDefault: boolean;
  loaded: boolean;
  confirming: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-line/50 hover:bg-elev/40 transition-colors">
      <td className="px-4 py-2.5">
        <div className="font-mono text-[12.5px] font-medium flex items-center gap-2">
          {m.name}
          {isDefault && <Badge tone="acc">default</Badge>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-mut">{m.details?.family_name || m.details?.family || "—"}</td>
      <td className="px-3 py-2.5 font-mono text-[12px] text-mut">
        {m.details?.parameter_size
          ? m.details.parameter_size +
            (m.details.quantization_level ? ` ${m.details.quantization_level}` : "")
          : "—"}
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px]">{formatBytes(m.size)}</td>
      <td className="px-3 py-2.5">
        {loaded ? <Badge tone="ok">loaded</Badge> : <Badge tone="mut">idle</Badge>}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {!isDefault && (
            <Button size="sm" variant="ghost" onClick={onSetDefault} title="Set as default model">
              <Icon name="check" className="w-3.5 h-3.5" />
              default
            </Button>
          )}
          {confirming ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="danger" onClick={onDelete}>
                confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={onDisarm}>
                <Icon name="x" className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={onArm} title="Delete model" className="hover:text-err">
              <Icon name="trash" className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
