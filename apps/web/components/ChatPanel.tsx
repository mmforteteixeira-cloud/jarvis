"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Spinner } from "./ui/EmptyState";
import { TalkButton } from "./TalkButton";

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

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"REAL" | "DEMO" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      return res.message.content;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach JARVIS.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-faint">
            <p className="font-mono text-sm">JARVIS is listening.</p>
            <p className="max-w-sm text-xs">
              Ask a question, or give a goal like "Cria uma aplicação de currículos" to generate a project plan.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message JARVIS..."
          className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />
        <TalkButton onFinalTranscript={(text) => send(text)} />
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
