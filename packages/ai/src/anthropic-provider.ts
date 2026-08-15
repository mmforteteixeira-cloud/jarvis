import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@jarvis/shared";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types.js";

const logger = createLogger("ai:anthropic");

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly mode = "REAL" as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
      system: request.system,
      messages: request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { text, providerName: this.name, model: this.model, mode: this.mode };
  }

  async completeStream(request: AICompletionRequest, onToken: (delta: string) => void): Promise<AICompletionResult> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
      system: request.system,
      messages: request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    stream.on("text", (delta) => onToken(delta));
    const text = await stream.finalText();

    return { text, providerName: this.name, model: this.model, mode: this.mode };
  }
}
