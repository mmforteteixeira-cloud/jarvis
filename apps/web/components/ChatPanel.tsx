"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Spinner } from "./ui/EmptyState";
import { TalkButton } from "./TalkButton";
import { JarvisOrb, type JarvisOrbState } from "./JarvisOrb";
import { useAppUI } from "./providers";
import type { VoiceState } from "@jarvis/voice";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  aiMode: "REAL" | "DEMO";
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

const QUICK_COMMANDS = [
  { label: "Estado do sistema", prompt: "Qual é o estado atual do sistema?" },
  { label: "Tarefas pendentes", prompt: "Que tarefas estão pendentes?" },
  { label: "Atividade recente", prompt: "Mostra-me as atividades mais recentes." },
  { label: "Criar projeto", prompt: "Cria uma aplicação de gestão de tarefas." },
];

function orbStateFor(sending: boolean, voice: VoiceState, hasError: boolean): JarvisOrbState {
  if (voice === "LISTENING") return "listening";
  if (voice === "SPEAKING") return "speaking";
  if (voice === "TRANSCRIBING" || voice === "THINKING" || sending) return "thinking";
  if (voice === "ERROR" || hasError) return "error";
  return "idle";
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"REAL" | "DEMO" | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setJarvisState } = useAppUI();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setJarvisState(orbStateFor(sending, voiceState, !!error));
  }, [sending, voiceState, error, setJarvisState]);

  async function loadConversations() {
    try {
      const res = await api.get<{ conversations: ConversationSummary[] }>("/api/chat");
      setConversations(res.conversations);
    } catch {
      // history is a convenience feature — a failed fetch shouldn't block chat
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function openConversation(id: string) {
    setHistoryOpen(false);
    if (id === conversationId) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await api.get<{ messages: ChatMessage[] }>(`/api/chat?conversationId=${id}`);
      setMessages(res.messages);
      setConversationId(id);
      setAiMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewChat() {
    setHistoryOpen(false);
    setConversationId(undefined);
    setMessages([]);
    setAiMode(null);
    setError(null);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: trimmed, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await api.post<ChatResponse>("/api/chat", { message: trimmed, conversationId });
      setConversationId(res.conversationId);
      setAiMode(res.aiMode);
      setMessages((prev) => [...prev, res.message]);
      loadConversations();
      return res.message.content;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach JARVIS.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <JarvisOrb state={orbStateFor(sending, voiceState, !!error)} size={28} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {conversationId ? "session active" : "new session"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-md border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-dim hover:border-accent/40 hover:text-accent"
          >
            + New
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setHistoryOpen((o) => !o);
                if (!historyOpen) loadConversations();
              }}
              className="rounded-md border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-dim hover:border-accent/40 hover:text-accent"
            >
              History{conversations.length > 0 ? ` (${conversations.length})` : ""}
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-border bg-surface-raised shadow-xl animate-jarvis-fade-in-up">
                {conversations.length === 0 ? (
                  <p className="p-3 text-xs text-ink-faint">No conversations yet.</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={`block w-full truncate border-b border-border px-3 py-2 text-left text-xs last:border-b-0 ${
                        c.id === conversationId ? "bg-accent-soft text-accent" : "text-ink-dim hover:bg-surface hover:text-ink"
                      }`}
                      title={c.title}
                    >
                      {c.title || "New conversation"}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {historyLoading && (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}
        {!historyLoading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-faint">
            <p className="font-mono text-sm">JARVIS is listening.</p>
            <p className="max-w-sm text-xs">
              Ask a question, or give a goal like "Cria uma aplicação de currículos" to generate a project plan.
            </p>
          </div>
        )}
        {!historyLoading &&
          messages.map((m) => (
            <div key={m.id} className={`flex animate-jarvis-fade-in-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-accent-soft text-ink border border-accent/20"
                    : "bg-surface-raised text-ink-dim border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        {sending && (
          <div className="flex items-center gap-2 text-ink-faint">
            <Spinner />
            <span className="font-mono text-xs">JARVIS is thinking...</span>
          </div>
        )}
      </div>

      {error && <p className="mt-2 font-mono text-xs text-signal-error">{error}</p>}
      {aiMode === "DEMO" && (
        <p className="mt-2 font-mono text-[11px] text-signal-warn">
          DEMO mode — no AI_API_KEY configured. Responses are deterministic, not real reasoning.
        </p>
      )}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {QUICK_COMMANDS.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={sending}
            onClick={() => send(q.prompt)}
            className="shrink-0 rounded-full border border-border px-3 py-1 font-mono text-[11px] text-ink-dim transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message JARVIS..."
          className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />
        <TalkButton onFinalTranscript={(text) => send(text)} onStateChange={setVoiceState} />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
