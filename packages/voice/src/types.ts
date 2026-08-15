/**
 * Voice Abstraction Layer — provider-agnostic by design. Nothing in JARVIS
 * Core should ever import ElevenLabs or the Web Speech API directly; they
 * both implement these interfaces instead.
 */

export type VoiceState = "IDLE" | "LISTENING" | "TRANSCRIBING" | "THINKING" | "SPEAKING" | "ERROR";

export interface STTResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface STTProvider {
  readonly name: string;
  readonly mode: "REAL" | "NOT_CONFIGURED";
  start(onResult: (result: STTResult) => void, onError: (error: Error) => void): void;
  stop(): void;
}

export interface TTSProvider {
  readonly name: string;
  readonly mode: "REAL" | "NOT_CONFIGURED";
  /** Server-side providers return audio bytes; browser providers speak directly and return null. */
  speak(text: string): Promise<ArrayBuffer | null>;
  stop(): void;
}

export interface VoiceConversationEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
}
