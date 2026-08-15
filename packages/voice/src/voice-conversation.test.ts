import { describe, expect, it, vi } from "vitest";
import { VoiceConversation } from "./voice-conversation.js";
import type { STTProvider, TTSProvider } from "./types.js";

class MockSTTProvider implements STTProvider {
  readonly name = "mock-stt";
  readonly mode = "REAL" as const;
  start(): void {}
  stop(): void {}
}

class MockTTSProvider implements TTSProvider {
  readonly name = "mock-tts";
  readonly mode = "REAL" as const;
  private rejectFn: ((err: Error) => void) | null = null;
  private resolveFn: (() => void) | null = null;

  speak(): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      this.resolveFn = () => resolve(null);
      this.rejectFn = reject;
    });
  }

  stop(): void {
    this.rejectFn?.(new Error("canceled"));
    this.rejectFn = null;
    this.resolveFn = null;
  }

  finishSuccessfully(): void {
    this.resolveFn?.();
  }

  failWithError(): void {
    this.rejectFn?.(new Error("synthesis failed"));
  }
}

describe("VoiceConversation", () => {
  it("completes speak() normally, ending IDLE with no error", async () => {
    const tts = new MockTTSProvider();
    const onError = vi.fn();
    const conversation = new VoiceConversation(new MockSTTProvider(), tts, { onError });

    const speaking = conversation.speak("hello");
    expect(conversation.getState()).toBe("SPEAKING");
    tts.finishSuccessfully();
    await speaking;

    expect(conversation.getState()).toBe("IDLE");
    expect(onError).not.toHaveBeenCalled();
  });

  it("treats stop() during SPEAKING as a clean interruption (barge-in), not an error", async () => {
    const tts = new MockTTSProvider();
    const onError = vi.fn();
    const conversation = new VoiceConversation(new MockSTTProvider(), tts, { onError });

    const speaking = conversation.speak("this will be interrupted");
    expect(conversation.getState()).toBe("SPEAKING");

    conversation.stop();
    await speaking;

    expect(conversation.getState()).toBe("IDLE");
    expect(onError).not.toHaveBeenCalled();
  });

  it("surfaces a genuine TTS failure as ERROR", async () => {
    const tts = new MockTTSProvider();
    const onError = vi.fn();
    const conversation = new VoiceConversation(new MockSTTProvider(), tts, { onError });

    const speaking = conversation.speak("this will fail");
    tts.failWithError();
    await speaking;

    expect(conversation.getState()).toBe("ERROR");
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
