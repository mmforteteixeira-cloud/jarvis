import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types.js";

/**
 * Zero-cost fallback used when no AI_API_KEY / OPENAI_API_KEY is configured.
 * It is NOT an LLM — it is a transparent, deterministic responder so JARVIS
 * still functions (and is honest about it) with no external dependency.
 * The UI must always show this as DEMO mode, never as a real AI response.
 */
export class HeuristicProvider implements AIProvider {
  readonly name = "heuristic";
  readonly mode = "DEMO" as const;
  readonly model = "jarvis-heuristic-v1";

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const input = lastUser?.content?.trim() ?? "";

    const text = input
      ? `[DEMO MODE — no AI_API_KEY configured] I received: "${input}". ` +
        `I can still create projects, tasks and use LOW_RISK tools deterministically, ` +
        `but I can't reason about open-ended requests without a real language model. ` +
        `Set AI_API_KEY (Anthropic) or OPENAI_API_KEY in .env to enable real reasoning.`
      : `[DEMO MODE — no AI_API_KEY configured] Waiting for input.`;

    return { text, providerName: this.name, model: this.model, mode: this.mode };
  }
}
