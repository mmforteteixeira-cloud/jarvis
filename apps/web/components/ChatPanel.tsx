"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Spinner } from "./ui/EmptyState";
import { TalkButton } from "./TalkButton";
import { JarvisOrb, type JarvisOrbState } from "./JarvisOrb";
import { MarkdownMessage } from "./MarkdownMessage";
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
  executedTask?: { agentType: string | null; state: string };
  createdPlan?: { project: { name: string }; tasks: unknown[] };
}

interface MessageMeta {
  badge: string;
  tone: "info" | "success" | "warn" | "error";
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

function orbStateFor(
  sending: boolean,
  streamingTokens: boolean,
  voice: VoiceState,
  hasError: boolean,
  justSucceeded: boolean,
): JarvisOrbState {
  if (voice === "LISTENING") return "listening";
  if (voice === "SPEAKING") return "speaking";
  if (streamingTokens) return "speaking";
  if (voice === "TRANSCRIBING" || voice === "THINKING" || sending) return "thinking";
  if (voice === "ERROR" || hasError) return "error";
  if (justSucceeded) return "success";
  return "idle";
}

function metaFor(res: ChatResponse): MessageMeta | null {
  if (res.executedTask) {
    const { state, agentType } = res.executedTask;
    if (state === "COMPLETED") return { badge: `${agentType ?? "agent"} · done`, tone: "success" };
    if (state === "WAITING_APPROVAL") return { badge: "awaiting approval", tone: "warn" };
    if (state === "FAILED") return { badge: `${agentType ?? "agent"} · failed`, tone: "error" };
    return { badge: `${agentType ?? "agent"} · ${state.toLowerCase()}`, tone: "info" };
  }
  if (res.createdPlan) {
    return { badge: `plan created · ${res.createdPlan.tasks.length} tasks`, tone: "success" };
  }
  return null;
}

function parseSSEChunk(raw: string): { event?: string; data?: unknown } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const dataStr = dataLines.join("\n");
  if (!dataStr) return { event };
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event };
  }
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageMeta, setMessageMeta] = useState<Record<string, MessageMeta>>({});
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"REAL" | "DEMO" | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [justSucceeded, setJustSucceeded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setJarvisState } = useAppUI();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setJarvisState(orbStateFor(sending, streamingId !== null, voiceState, !!error, justSucceeded));
  }, [sending, streamingId, voiceState, error, justSucceeded, setJarvisState]);

  function flashSuccess() {
    setJustSucceeded(true);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setJustSucceeded(false), 900);
  }

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

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
      setMessageMeta({});
      setConversationId(id);
      setAiMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function renameConversation(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
    setRenamingId(null);
    try {
      await api.patch(`/api/chat/${id}`, { title: trimmed });
    } catch {
      loadConversations();
    }
  }

  async function deleteConversationById(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) startNewChat();
    try {
      await api.del(`/api/chat/${id}`);
    } catch {
      loadConversations();
    }
  }

  function startNewChat() {
    setHistoryOpen(false);
    setConversationId(undefined);
    setMessages([]);
    setMessageMeta({});
    setAiMode(null);
    setError(null);
  }

  function stopStreaming() {
    abortRef.current?.abort();
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

    const streamId = `stream-${Date.now()}`;
    setMessages((prev) => [...prev, { id: streamId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let receivedAnyToken = false;
    let finalText: string | undefined;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Request failed with ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let settled = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawChunk = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const { event, data } = parseSSEChunk(rawChunk);
          if (!event) continue;

          if (event === "token") {
            receivedAnyToken = true;
            setStreamingId(streamId);
            accumulated += (data as { delta: string }).delta;
            const snapshot = accumulated;
            setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: snapshot } : m)));
          } else if (event === "final") {
            const final = data as ChatResponse;
            settled = true;
            setConversationId(final.conversationId);
            setAiMode(final.aiMode);
            setMessages((prev) => prev.map((m) => (m.id === streamId ? final.message : m)));
            finalText = final.message.content;
            const meta = metaFor(final);
            if (meta) setMessageMeta((prev) => ({ ...prev, [final.message.id]: meta }));
            if (!meta || meta.tone === "success" || meta.tone === "info") flashSuccess();
            loadConversations();
          } else if (event === "error") {
            throw new Error((data as { message?: string })?.message ?? "Stream failed");
          }
        }
      }

      if (!settled) throw new Error("Stream ended unexpectedly.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamId ? { ...m, content: m.content || "(cancelled)" } : m)),
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to reach JARVIS.");
        setMessages((prev) => (receivedAnyToken ? prev : prev.filter((m) => m.id !== streamId)));
      }
    } finally {
      setSending(false);
      setStreamingId(null);
      abortRef.current = null;
    }

    return finalText;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <JarvisOrb state={orbStateFor(sending, streamingId !== null, voiceState, !!error, justSucceeded)} size={28} />
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
                  conversations.map((c) =>
                    renamingId === c.id ? (
                      <form
                        key={c.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameConversation(c.id, renameValue);
                        }}
                        className="flex items-center gap-1 border-b border-border px-2 py-1.5 last:border-b-0"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => renameConversation(c.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded border border-accent/40 bg-surface px-1.5 py-1 text-xs text-ink outline-none"
                        />
                      </form>
                    ) : (
                      <div
                        key={c.id}
                        className={`group flex items-center border-b border-border last:border-b-0 ${
                          c.id === conversationId ? "bg-accent-soft text-accent" : "text-ink-dim hover:bg-surface hover:text-ink"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(c.id)}
                          className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs"
                          title={c.title}
                        >
                          {c.title || "New conversation"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameValue(c.title);
                          }}
                          className="hidden shrink-0 px-1.5 text-ink-faint hover:text-accent group-hover:inline"
                          title="Rename"
                          aria-label="Rename conversation"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteConversationById(c.id)}
                          className="hidden shrink-0 px-1.5 pr-3 text-ink-faint hover:text-signal-error group-hover:inline"
                          title="Delete"
                          aria-label="Delete conversation"
                        >
                          ✕
                        </button>
                      </div>
                    ),
                  )
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
          messages.map((m) => {
            const meta = messageMeta[m.id];
            const isStreamingThis = m.id === streamingId;
            return (
              <div key={m.id} className={`flex animate-jarvis-fade-in-up flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-accent-soft text-sm text-ink border border-accent/20"
                      : "bg-surface-raised text-ink-dim border border-border"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <MarkdownMessage content={m.content} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-faint">
                      <Spinner /> thinking...
                    </span>
                  )}
                  {isStreamingThis && m.content && (
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-jarvis-pulse bg-accent align-text-bottom" />
                  )}
                </div>
                {meta && (
                  <span
                    className={`mt-1 font-mono text-[10px] uppercase tracking-wide ${
                      meta.tone === "success"
                        ? "text-accent"
                        : meta.tone === "warn"
                          ? "text-signal-warn"
                          : meta.tone === "error"
                            ? "text-signal-error"
                            : "text-ink-faint"
                    }`}
                  >
                    {meta.badge}
                  </span>
                )}
              </div>
            );
          })}
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
        {sending ? (
          <button
            type="button"
            onClick={stopStreaming}
            className="rounded-md border border-signal-error/40 bg-signal-error/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-signal-error hover:bg-signal-error/20"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
