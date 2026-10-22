"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, formatMs, timeAgo } from "@/lib/api";
import type {
  Conversation,
  HarnessInfo,
  MessageRow,
  ToolCallRecord,
} from "@/lib/types";
import { Badge, Button, Icon, Select, Spinner, useToast } from "./ui";
import { Markdown } from "./Markdown";

type LiveToolCall = ToolCallRecord & { pending?: boolean };

interface StreamState {
  cid: string;
  content: string;
  toolCalls: LiveToolCall[];
  error?: string;
  aborted?: boolean;
}

const QUICK_PROMPTS = [
  {
    icon: "cpu",
    title: "Inspect the Ollama server",
    text: "Use http_get on the /api/tags endpoint of the Ollama server (its URL is in the environment block) and list every installed model with its name and size.",
  },
  {
    icon: "terminal",
    title: "Probe the host",
    text: "Run `uname -a`, `node --version` and `ls` via the bash tool, then summarize the host platform and what is in the workspace.",
  },
  {
    icon: "globe",
    title: "Read the Ollama docs",
    text: "Use http_get to fetch https://github.com/ollama/ollama and summarize the top 5 features of the project from the README.",
  },
];

export function ChatView({
  info,
  refreshInfo,
}: {
  info: HarnessInfo;
  refreshInfo: () => void;
}) {
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<StreamState | null>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(info.settings.model);
  const [delId, setDelId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadConvs = useCallback(async () => {
    try {
      const d = await api<{ conversations: Conversation[] }>("/api/conversations");
      if (mountedRef.current) setConvs(d.conversations);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadMsgs = useCallback(async (cid: string) => {
    try {
      const d = await api<{ conversation: Conversation; messages: MessageRow[] }>(
        `/api/conversations/${cid}`
      );
      if (mountedRef.current) setMsgs(d.messages);
    } catch (e) {
      if (mountedRef.current) toast(`Failed to load conversation: ${(e as Error).message}`, "err");
    }
  }, [toast]);

  useEffect(() => {
    loadConvs();
    const saved = localStorage.getItem("harness.active");
    if (saved) {
      setActiveId(saved);
      loadMsgs(saved);
    }
  }, [loadConvs, loadMsgs]);

  useEffect(() => {
    if (activeId) localStorage.setItem("harness.active", activeId);
    else localStorage.removeItem("harness.active");
  }, [activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [msgs, stream?.content, stream?.toolCalls.length]);

  const openConv = (cid: string) => {
    if (cid === activeId) return;
    setActiveId(cid);
    setStream(null);
    loadMsgs(cid);
  };

  const newConv = () => {
    setActiveId(null);
    setMsgs([]);
    setStream(null);
  };

  const deleteConv = async (cid: string) => {
    try {
      await api(`/api/conversations/${cid}`, { method: "DELETE" });
      setConvs((c) => c.filter((x) => x.id !== cid));
      if (activeId === cid) newConv();
      toast("Conversation deleted", "ok");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const handleEvent = (ev: Record<string, unknown>, s: StreamState) => {
    const type = ev.type as string;
    if (type === "delta") {
      s.content += ev.content as string;
    } else if (type === "tool_start") {
      s.toolCalls.push({
        name: ev.name as string,
        args: (ev.args as Record<string, unknown>) ?? {},
        result: "",
        ok: false,
        ms: 0,
        pending: true,
      });
    } else if (type === "tool_end") {
      for (let i = s.toolCalls.length - 1; i >= 0; i--) {
        const tc = s.toolCalls[i];
        if (tc && tc.pending && tc.name === (ev.name as string)) {
          tc.result = ev.result as string;
          tc.ok = ev.ok as boolean;
          tc.ms = ev.ms as number;
          tc.truncated = ev.truncated as boolean;
          tc.pending = false;
          break;
        }
      }
    } else if (type === "error") {
      s.error = ev.message as string;
    } else if (type === "done") {
      s.aborted = ev.aborted as boolean | undefined;
      if (!s.content && ev.content) s.content = ev.content as string;
    }
    setStream({ ...s });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    let cid = activeId;
    setInput("");
    setBusy(true);
    try {
      if (!cid) {
        const d = await api<{ conversation: Conversation }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ model }),
        });
        cid = d.conversation.id;
        setActiveId(cid);
      }
      setMsgs((m) => [
        ...m,
        {
          id: "tmp-user",
          role: "user",
          content: text,
          meta: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      const s: StreamState = { cid: cid!, content: "", toolCalls: [] };
      setStream(s);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: cid, message: text, model }),
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        s.error = d.error ?? `HTTP ${res.status}`;
        setStream({ ...s });
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
          if (mountedRef.current) handleEvent(ev, s);
        }
      }
    } catch (e) {
      if (mountedRef.current) {
        setStream((st) =>
          st ? { ...st, error: `Connection error: ${(e as Error).message}` } : st
        );
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        if (cid && activeIdRef.current === cid) loadMsgs(cid);
        loadConvs();
        refreshInfo();
        setTimeout(() => {
          if (mountedRef.current) setStream((st) => (st && st.cid === cid ? null : st));
        }, 350);
      }
    }
  };

  const stop = async () => {
    if (stream) {
      await api("/api/chat/stop", {
        method: "POST",
        body: JSON.stringify({ conversationId: stream.cid }),
      }).catch(() => {});
    }
  };

  const exportMd = () => {
    if (!activeId) return;
    const conv = convs.find((c) => c.id === activeId);
    let md = `# ${conv?.title ?? "Conversation"}\n\n_Exported from Harness · ${new Date().toISOString()}_\n\n`;
    for (const m of msgs) {
      md += `## ${m.role === "user" ? "You" : info.settings.model}\n\n${m.content}\n\n`;
      for (const tc of m.meta?.toolCalls ?? []) {
        md += `> **tool** \`${tc.name}\` — ${tc.ok ? "ok" : "error"} · ${tc.ms} ms\n>\n`;
        for (const line of tc.result.split("\n").slice(0, 20)) md += `> ${line}\n`;
        md += "\n";
      }
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(conv?.title ?? "conversation").replace(/[^\w-]+/g, "-").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported as Markdown", "ok");
  };

  const modelOptions = Array.from(
    new Set(
      [
        ...info.ollama.models.map((m) => m.name),
        info.settings.model,
        model,
      ].filter((x): x is string => Boolean(x))
    )
  );

  const activeConv = convs.find((c) => c.id === activeId);
  const streamingHere = stream && stream.cid === activeId;

  return (
    <div className="h-full flex min-h-0">
      {/* conversations rail */}
      <div className="w-64 shrink-0 border-r border-line bg-panel/40 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-mut">
            Conversations
          </span>
          <Button size="sm" variant="ghost" onClick={newConv} title="New conversation">
            <Icon name="plus" className="w-3.5 h-3.5" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {convs.length === 0 && (
            <div className="text-[12px] text-dim px-2 py-4">
              No conversations yet. Send a message to start one.
            </div>
          )}
          {convs.map((c) => (
            <div
              key={c.id}
              className={`group relative rounded-md border transition-colors ${
                c.id === activeId
                  ? "border-line2 bg-elev"
                  : "border-transparent hover:bg-elev/60"
              }`}
            >
              <button
                onClick={() => openConv(c.id)}
                className="w-full text-left px-3 py-2 pr-8"
              >
                <div className="text-[13px] font-medium truncate">{c.title}</div>
                <div className="text-[10.5px] text-dim mt-0.5 font-mono">
                  {timeAgo(c.updatedAt)}
                  {c.model ? ` · ${c.model.split(":")[0]}` : ""}
                </div>
              </button>
              {delId === c.id ? (
                <button
                  onClick={() => {
                    setDelId(null);
                    deleteConv(c.id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-err bg-err/10 border border-err/30 rounded px-1.5 py-0.5"
                >
                  sure?
                </button>
              ) : (
                <button
                  onClick={() => setDelId(c.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-dim hover:text-err p-1 transition-opacity"
                  title="Delete"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* chat column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* chat header */}
        <div className="h-11 shrink-0 border-b border-line flex items-center gap-2 px-4">
          <div className="text-[13px] font-medium truncate">
            {activeConv ? activeConv.title : "New conversation"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="!w-44 !py-1 !text-xs !pr-7"
              title="Model for this conversation"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="ghost" onClick={exportMd} disabled={!msgs.length} title="Export as Markdown">
              <Icon name="download" className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {msgs.length === 0 && !streamingHere && (
              <EmptyState onPick={(t) => setInput(t)} reachable={info.ollama.reachable} />
            )}
            {msgs.map((m) => (
              <Message key={m.id} m={m} modelName={info.settings.model} />
            ))}
            {streamingHere && stream && (
              <div>
                {stream.toolCalls.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {stream.toolCalls.map((tc, i) => (
                      <ToolCard key={i} tc={tc} />
                    ))}
                  </div>
                )}
                {stream.content ? (
                  <Markdown content={stream.content} streaming={!busy} />
                ) : (
                  !busy && !stream.toolCalls.length ? null : (
                    <div className="flex items-center gap-2 text-mut text-[13px]">
                      <Spinner className="w-3.5 h-3.5 text-acc" />
                      {stream.toolCalls.length ? "continuing…" : "model is thinking…"}
                    </div>
                  )
                )}
                {stream.error && <ErrorNote msg={stream.error} />}
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="shrink-0 border-t border-line bg-panel/50 px-5 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="bg-elev border border-line rounded-lg focus-within:border-acc/50 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={input.split("\n").length > 4 ? 6 : Math.min(4, Math.max(1, input.split("\n").length))}
                placeholder={
                  info.ollama.reachable
                    ? `Message the agent (Enter to send, Shift+Enter for a new line)…`
                    : "Ollama is offline — start it with: ollama serve. You can still configure everything else."
                }
                className="w-full bg-transparent px-3.5 pt-3 pb-1 text-sm resize-none focus:outline-none placeholder:text-dim"
                disabled={busy}
              />
              <div className="flex items-center gap-2 px-2.5 pb-2.5">
                <span className="font-mono text-[10.5px] text-dim">
                  {model} · {info.availableTools.length} tools · skills:{" "}
                  {info.skills.filter((s) => s.enabled && info.settings.activeSkills.includes(s.id)).length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {busy ? (
                    <Button variant="danger" size="sm" onClick={stop}>
                      <Icon name="stop" className="w-3.5 h-3.5" />
                      Stop run
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={send} disabled={!input.trim()}>
                      <Icon name="send" className="w-3.5 h-3.5" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-dim">
              max {info.settings.maxToolSteps} tool steps · ctx {info.settings.numCtx} ·
              temp {info.settings.temperature}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ sub components ----------------------------- */

function EmptyState({ onPick, reachable }: { onPick: (t: string) => void; reachable: boolean }) {
  return (
    <div className="pt-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accdim border border-acc/30 text-acc mb-4">
          <Icon name="terminal" className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Local agent, fully wired</h2>
        <p className="text-mut text-sm mt-2 max-w-md mx-auto">
          Every response is generated by your Ollama model with real tool execution —
          shell, files, HTTP and memory. Nothing is simulated.
          {!reachable && (
            <span className="block mt-2 text-warn">
              Ollama is offline. Start it with <code className="font-mono text-[12px] bg-elev px-1.5 py-0.5 rounded border border-line">ollama serve</code> and pull a model.
            </span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.title}
            onClick={() => onPick(q.text)}
            className="text-left rounded-lg border border-line bg-panel hover:border-acc/40 hover:bg-elev p-4 transition-colors group"
          >
            <Icon name={q.icon} className="w-4 h-4 text-acc mb-2.5" />
            <div className="text-[13px] font-semibold group-hover:text-acc transition-colors">
              {q.title}
            </div>
            <div className="text-[11.5px] text-mut mt-1 line-clamp-3">{q.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ m, modelName }: { m: MessageRow; modelName: string }) {
  const isUser = m.role === "user";
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-[10px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded border ${
            isUser
              ? "text-warn border-warn/30 bg-warn/10"
              : "text-acc border-acc/30 bg-accdim"
          }`}
        >
          {isUser ? "you" : modelName || "model"}
        </span>
        {m.meta?.aborted && <Badge tone="warn">stopped</Badge>}
        <span className="font-mono text-[10px] text-dim">
          {new Date(m.createdAt).toLocaleTimeString()}
        </span>
      </div>
      <div
        className={`rounded-lg border px-4 py-3 ${
          isUser ? "border-line bg-elev/50" : "border-line/60 bg-panel/40"
        }`}
      >
        {m.meta?.toolCalls && m.meta.toolCalls.length > 0 && (
          <div className="space-y-2 mb-3">
            {m.meta.toolCalls.map((tc, i) => (
              <ToolCard key={i} tc={tc} />
            ))}
          </div>
        )}
        {m.content ? (
          isUser ? (
            <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <Markdown content={m.content} />
          )
        ) : (
          !m.meta?.toolCalls?.length && <div className="text-dim text-[13px] italic">(empty)</div>
        )}
      </div>
      {!isUser && m.meta && (m.meta.toolCalls?.length || m.meta.totalMs) && (
        <div className="mt-1.5 font-mono text-[10px] text-dim flex gap-3">
          {m.meta.steps ? <span>{m.meta.steps} step{m.meta.steps > 1 ? "s" : ""}</span> : null}
          {m.meta.promptTokens ? <span>↑ {m.meta.promptTokens} tok</span> : null}
          {m.meta.completionTokens ? <span>↓ {m.meta.completionTokens} tok</span> : null}
          {m.meta.totalMs ? <span>{formatMs(m.meta.totalMs)}</span> : null}
        </div>
      )}
    </div>
  );
}

function ToolCard({ tc }: { tc: LiveToolCall }) {
  const [open, setOpen] = useState(false);
  const firstArg = Object.entries(tc.args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ")
    .slice(0, 160);
  return (
    <div className="rounded-md border border-line bg-[#0a0d10] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elev/60 transition-colors"
      >
        <Icon name="wrench" className="w-3.5 h-3.5 text-acc shrink-0" />
        <span className="font-mono text-[12px] font-semibold text-ink">{tc.name}</span>
        {tc.pending ? (
          <span className="flex items-center gap-1.5 text-[11px] text-warn">
            <Spinner className="w-3 h-3" /> running…
          </span>
        ) : (
          <>
            <Badge tone={tc.ok ? "ok" : "err"}>{tc.ok ? "ok" : "error"}</Badge>
            <span className="font-mono text-[10.5px] text-dim">{formatMs(tc.ms)}</span>
          </>
        )}
        <span className="ml-auto font-mono text-[10.5px] text-dim truncate max-w-[40%]" title={firstArg}>
          {firstArg}
        </span>
        <Icon
          name="chevron"
          className={`w-3.5 h-3.5 text-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5 space-y-2.5">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-dim uppercase mb-1">
              arguments
            </div>
            <pre className="font-mono text-[11.5px] text-mut whitespace-pre-wrap break-all">
              {JSON.stringify(tc.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-dim uppercase mb-1">
              result
            </div>
            <pre className="font-mono text-[11.5px] whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-ink/85">
              {tc.result || (tc.pending ? "…" : "(no output)")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-md border border-err/40 bg-err/10 px-3.5 py-2.5 text-[13px]">
      <Icon name="alert" className="w-4 h-4 text-err shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-err">Agent error</span>{" "}
        <span className="text-ink/85 font-mono text-[12px] break-words">{msg}</span>
      </div>
    </div>
  );
}
