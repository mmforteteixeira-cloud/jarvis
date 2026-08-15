import { IntegrationNotConfiguredError } from "@jarvis/shared";
import type { TTSProvider } from "./types.js";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs' public "Rachel" demo voice

/**
 * Server-side TTS via ElevenLabs. Real HTTP calls — no key means it throws
 * IntegrationNotConfiguredError, which callers (the voice API route) turn
 * into a NOT_CONFIGURED response rather than fabricating audio.
 */
export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs";

  get mode(): "REAL" | "NOT_CONFIGURED" {
    return process.env.ELEVENLABS_API_KEY ? "REAL" : "NOT_CONFIGURED";
  }

  async speak(text: string): Promise<ArrayBuffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new IntegrationNotConfiguredError("elevenlabs");

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS request failed: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  stop(): void {
    // Server-side synthesis is request/response, not a stream to cancel.
  }
}
