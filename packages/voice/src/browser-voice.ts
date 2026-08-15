import type { STTProvider, STTResult, TTSProvider } from "./types.js";

// The Web Speech API's SpeechRecognition isn't in TypeScript's standard DOM
// lib (it shipped vendor-prefixed and was never fully standardized). Minimal
// ambient shape for the parts JARVIS actually uses.
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

/**
 * Zero-cost STT using the browser's built-in Web Speech API. Only works in
 * browsers that implement it (Chrome/Edge); reports NOT_CONFIGURED
 * everywhere else (including any server-side render) rather than pretending
 * to listen.
 */
export class BrowserSTTProvider implements STTProvider {
  readonly name = "browser-web-speech";
  private recognition: SpeechRecognitionLike | null = null;

  get mode(): "REAL" | "NOT_CONFIGURED" {
    return getSpeechRecognitionCtor() ? "REAL" : "NOT_CONFIGURED";
  }

  start(onResult: (result: STTResult) => void, onError: (error: Error) => void): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError(new Error("SpeechRecognition is not available in this browser."));
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        onResult({ text: alt.transcript, isFinal: result.isFinal, confidence: alt.confidence });
      }
    };
    recognition.onerror = (event) => onError(new Error(`Speech recognition error: ${event.error}`));

    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

/**
 * Zero-cost TTS using the browser's built-in SpeechSynthesis API.
 */
export class BrowserTTSProvider implements TTSProvider {
  readonly name = "browser-speech-synthesis";

  get mode(): "REAL" | "NOT_CONFIGURED" {
    return typeof window !== "undefined" && "speechSynthesis" in window ? "REAL" : "NOT_CONFIGURED";
  }

  async speak(text: string): Promise<null> {
    if (this.mode !== "REAL") throw new Error("speechSynthesis is not available in this browser.");
    return new Promise((resolvePromise, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolvePromise(null);
      utterance.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));
      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
