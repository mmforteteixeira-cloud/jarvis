import OpenAI from "openai";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly mode = "REAL" as const;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const messages = [
      ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
    });

    const text = response.choices[0]?.message?.content ?? "";
    return { text, providerName: this.name, model: this.model, mode: this.mode };
  }
}
