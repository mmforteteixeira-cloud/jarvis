import type { STTProvider, TTSProvider, VoiceConversationEvents, VoiceState } from "./types.js";

/**
 * Drives the IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING
 * state machine described in the architecture doc. Framework-agnostic —
 * the web app's "Talk to JARVIS" button wires this to React state.
 */
export class VoiceConversation {
  private state: VoiceState = "IDLE";

  constructor(
    private readonly stt: STTProvider,
    private readonly tts: TTSProvider,
    private readonly events: VoiceConversationEvents = {},
  ) {}

  getState(): VoiceState {
    return this.state;
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.events.onStateChange?.(state);
  }

  startListening(onFinalTranscript: (text: string) => void): void {
    if (this.stt.mode !== "REAL") {
      this.setState("ERROR");
      this.events.onError?.(new Error("No STT provider is available (browser Web Speech API not supported here)."));
      return;
    }
    this.setState("LISTENING");
    this.stt.start(
      (result) => {
        this.setState(result.isFinal ? "TRANSCRIBING" : "LISTENING");
        this.events.onTranscript?.(result.text, result.isFinal);
        if (result.isFinal && result.text.trim()) {
          this.stt.stop();
          this.setState("THINKING");
          onFinalTranscript(result.text.trim());
        }
      },
      (error) => {
        this.setState("ERROR");
        this.events.onError?.(error);
      },
    );
  }

  async speak(text: string): Promise<void> {
    this.setState("SPEAKING");
    try {
      await this.tts.speak(text);
      this.setState("IDLE");
    } catch (error) {
      this.setState("ERROR");
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  stop(): void {
    this.stt.stop();
    this.tts.stop();
    this.setState("IDLE");
  }
}
