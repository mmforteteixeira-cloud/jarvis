import { createLogger } from "@jarvis/shared";
import type { AIProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import { HeuristicProvider } from "./heuristic-provider.js";

const logger = createLogger("ai:factory");

let cached: AIProvider | null = null;

/**
 * Resolves the active AI provider from environment configuration. Order of
 * preference: explicit AI_PROVIDER + AI_API_KEY (Anthropic), then
 * OPENAI_API_KEY, then the heuristic (non-AI) fallback so the app never
 * crashes for lack of a key — it just runs in DEMO mode.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const anthropicKey = process.env.AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (provider === "anthropic" && anthropicKey) {
    cached = new AnthropicProvider(anthropicKey, process.env.AI_MODEL ?? "claude-sonnet-5");
    logger.info("Using Anthropic provider", { model: cached.model });
    return cached;
  }

  if (provider === "openai" && openaiKey) {
    cached = new OpenAIProvider(openaiKey, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
    logger.info("Using OpenAI provider", { model: cached.model });
    return cached;
  }

  // Fall back to whichever key is present, regardless of AI_PROVIDER value.
  if (anthropicKey) {
    cached = new AnthropicProvider(anthropicKey, process.env.AI_MODEL ?? "claude-sonnet-5");
    return cached;
  }
  if (openaiKey) {
    cached = new OpenAIProvider(openaiKey, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
    return cached;
  }

  logger.warn("No AI_API_KEY or OPENAI_API_KEY configured — running in heuristic DEMO mode");
  cached = new HeuristicProvider();
  return cached;
}

/** Test-only: force a specific provider instance. */
export function __setProviderForTests(provider: AIProvider | null): void {
  cached = provider;
}
