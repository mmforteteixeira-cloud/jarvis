"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserSTTProvider, BrowserTTSProvider, VoiceConversation, type VoiceState } from "@jarvis/voice";

const STATE_LABEL: Record<VoiceState, string> = {
  IDLE: "TALK TO JARVIS",
  LISTENING: "LISTENING...",
  TRANSCRIBING: "PROCESSING...",
  THINKING: "THINKING...",
  SPEAKING: "SPEAKING...",
  ERROR: "VOICE UNAVAILABLE",
};

export function TalkButton({
  onFinalTranscript,
  onStateChange,
}: {
  onFinalTranscript: (text: string) => Promise<string | undefined>;
  onStateChange?: (state: VoiceState) => void;
}) {
  const [state, setState] = useState<VoiceState>("IDLE");
  const [supported, setSupported] = useState(true);
  const conversationRef = useRef<VoiceConversation | null>(null);

  useEffect(() => {
    const stt = new BrowserSTTProvider();
    const tts = new BrowserTTSProvider();
    setSupported(stt.mode === "REAL");
    conversationRef.current = new VoiceConversation(stt, tts, {
      onStateChange: (next) => {
        setState(next);
        onStateChange?.(next);
      },
    });
    // onStateChange intentionally excluded — captured once at setup, matches VoiceConversation's own lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    const conversation = conversationRef.current;
    if (!conversation) return;

    if (state === "LISTENING") {
      conversation.stop();
      return;
    }
    if (state !== "IDLE" && state !== "ERROR") return;

    conversation.startListening(async (text) => {
      const reply = await onFinalTranscript(text);
      if (reply) await conversation.speak(reply);
      else setState("IDLE");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={supported ? "Talk to JARVIS (browser speech)" : "Speech recognition not supported in this browser"}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
        state === "LISTENING"
          ? "border-signal-error/50 bg-signal-error/10 text-signal-error"
          : state === "ERROR" || !supported
            ? "border-border text-ink-faint cursor-not-allowed"
            : "border-accent/40 bg-accent-soft text-accent hover:bg-accent/10"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${state === "LISTENING" ? "bg-signal-error animate-jarvis-pulse" : "bg-current"}`} />
      {supported ? STATE_LABEL[state] : "VOICE UNSUPPORTED"}
    </button>
  );
}
