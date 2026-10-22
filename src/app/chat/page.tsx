"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    isFinal: boolean;
    [index: number]: { transcript: string };
  }[];
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export default function ChatPage() {
  const [skills, setSkills] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [skillId, setSkillId] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [time, setTime] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Detect speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript + " ";
            } else {
              interim += transcript;
            }
          }
          if (final) {
            setInput(prev => (prev + " " + final).trim());
            setInterimTranscript("");
          } else {
            setInterimTranscript(interim);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setVoiceError(event.error);
          setIsListening(false);
          setInterimTranscript("");
          setTimeout(() => setVoiceError(""), 3000);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        setSpeechSupported(false);
      }
    }

    fetch("/api/skills").then(r => r.json()).then(d => setSkills(d.skills || []));
    fetch("/api/models").then(r => r.json()).then(d => setModels(d.models || []));
    const t = setInterval(() => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
    }, 1000);
    return () => {
      clearInterval(t);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const toggleListening = () => {
    setVoiceError("");
    if (!recognitionRef.current) return;
    if (isListening) {
      try { recognitionRef.current.stop(); } catch {}
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        setVoiceError(e.message || "start_failed");
      }
    }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    if (isListening) toggleListening();
    setSending(true);
    const msg = input.trim();
    setInput("");
    const userMsg = { role: "user", content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationId, skillId: skillId ? parseInt(skillId) : null, modelId: modelId ? parseInt(modelId) : null }),
      });
      const d = await res.json();
      if (d.ok) {
        setConversationId(d.conversationId);
        setMessages(prev => [...prev, { role: "assistant", content: d.response, id: Date.now() + 1, toolResults: d.toolResults || [] }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "ERR: " + (d.error || "UNKNOWN"), id: Date.now() + 1 }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "CONN_ERR: " + e.message, id: Date.now() + 1 }]);
    } finally { setSending(false); }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="hud-alert-box text-sm mb-2">COMMS_LINK</div>
            <p className="text-xs text-hud-text-dim tracking-wide">Direct inference · Skill-composed workflows · Tool result display</p>
          </div>
          <div className="text-xs font-mono text-hud-text-soft tracking-wider">{time}</div>
        </div>
        <div className="flex gap-2 mt-3">
          <select className="hud-input px-3 py-2 min-w-[200px]" value={skillId} onChange={e => setSkillId(e.target.value)}>
            <option value="">// DIRECT_MODEL</option>
            {skills.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="hud-input px-3 py-2 min-w-[200px]" value={modelId} onChange={e => setModelId(e.target.value)}>
            <option value="">// AUTO_DEFAULT</option>
            {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {conversationId && <div className="hud-input px-3 py-2 text-hud-text border-hud-text/50 tracking-wider">CONVO_ID: {conversationId}</div>}
        </div>
      </div>

      {/* Chat Window */}
      <div className="hud-panel hud-bracket flex-1 overflow-y-auto p-5 mb-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-hud-text-dim gap-4">
            <div className="text-center">
              <div className="text-xl tracking-widest text-hud-text mb-2">AWAITING_INPUT</div>
              <p className="text-[11px] mt-1 tracking-wider">Select skill/model and transmit message</p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-hud-text-dim tracking-wider space-y-1">
              <div>PROTOCOL: OLLAMA_REST</div>
              <div>MODE: {skillId ? "SKILL_COMPOSED" : "DIRECT_INFERENCE"}</div>
              <div>STATUS: IDLE</div>
              {speechSupported && <div className="text-hud-cyan mt-2">VOICE_INPUT: ENABLED</div>}
            </div>
          </div>
        )}
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((m: any) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 flex items-center justify-center shrink-0 border tracking-widest text-[10px] font-bold ${
                m.role === "user"
                  ? "border-hud-border text-hud-text"
                  : "border-hud-red text-hud-red"
              }`}>
                {m.role === "user" ? "OP" : "AI"}
              </div>
              <div className={`px-4 py-3 text-xs leading-relaxed max-w-[75%] border-l-2 ${
                m.role === "user"
                  ? "chat-user bg-hud-bg"
                  : "chat-ai bg-hud-panel"
              }`}>
                <div className="text-[10px] font-bold mb-1 tracking-widest opacity-70">{m.role === "user" ? "OPERATOR" : "HARNESS_AI"}</div>
                <div className="whitespace-pre-wrap tracking-wide">{m.content}</div>
                {m.toolResults && m.toolResults.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-hud-border">
                    <div className="text-[10px] font-bold text-hud-amber mb-1 tracking-widest">TOOL_RESULTS</div>
                    {m.toolResults.map((tr: any, i: number) => (
                      <div key={i} className="text-[11px] bg-hud-bg border border-hud-border p-2 mt-1 font-mono text-hud-text">
                        <div className="text-hud-amber font-bold text-[10px] tracking-wider">{tr.name || tr.tool_call_id}</div>
                        <div className="break-all">{typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content).slice(0, 200)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 border border-hud-red text-hud-red flex items-center justify-center text-[10px] font-bold tracking-widest">AI</div>
              <div className="border-l-2 border-hud-red bg-hud-panel px-4 py-3 text-xs flex items-center gap-2">
                <span className="tracking-widest">PROCESSING_INFERENCE...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Status */}
      {voiceError && (
        <div className="hud-alert-box text-xs mb-2">VOICE_ERR: {voiceError}</div>
      )}
      {isListening && (
        <div className="border border-hud-red bg-hud-red-dim/30 px-3 py-2 mb-2 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 bg-hud-red animate-pulse-glow rounded-full" />
          <span className="text-hud-red font-bold tracking-widest">LISTENING...</span>
          <span className="text-hud-text-dim truncate ml-2">{interimTranscript || "awaiting_speech"}</span>
        </div>
      )}

      {/* Input Area with Voice */}
      <div className="relative">
        {/* Interim transcript floating above */}
        {interimTranscript && (
          <div className="absolute bottom-full left-0 right-0 mb-1 px-4 py-2 bg-hud-bg border border-hud-cyan/30 text-xs text-hud-cyan font-mono tracking-wide italic">
            <span className="text-hud-text-dim text-[10px] tracking-widest mr-2">INTERIM:</span>
            {interimTranscript}
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Microphone button */}
          {speechSupported && (
            <button
              onClick={toggleListening}
              className={`p-3 border transition-all ${
                isListening
                  ? "bg-hud-red-dim border-hud-red text-hud-red animate-pulse-glow"
                  : "bg-hud-bg border-hud-border text-hud-text-soft hover:text-hud-cyan hover:border-hud-cyan"
              }`}
              title={isListening ? "STOP_RECORDING" : "START_VOICE_INPUT"}
              aria-label={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" strokeWidth={1.5} /> : <Mic className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          )}

          <input
            ref={inputRef}
            className="flex-1 hud-input px-4 py-3 text-xs"
            placeholder="> TRANSMIT_MESSAGE... (or click mic to speak)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button onClick={send} disabled={sending || !input.trim()} className="hud-btn-primary px-5 py-3 text-xs font-bold tracking-widest disabled:opacity-30 flex items-center gap-2">
            <Send className="w-4 h-4" /> TRANSMIT
          </button>
        </div>

        {/* Voice hint */}
        {speechSupported && !isListening && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
            <span className="text-hud-text-dim tracking-wider">VOICE_INPUT: AVAILABLE // CLICK_MIC TO_SPEAK</span>
            <span className="text-hud-text-dim tracking-wider">LANG: en-US</span>
          </div>
        )}
      </div>
    </div>
  );
}
