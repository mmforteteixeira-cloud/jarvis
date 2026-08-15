import { getAIProvider } from "@jarvis/ai";
import { createContent, updateContentState } from "@jarvis/db";
import { enforceAction } from "@jarvis/security";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

export type ContentAgentInput =
  | { op: "generateIdeas"; topic: string; count?: number }
  | { op: "writeScript"; topic: string; projectId?: string | null }
  | { op: "publishTikTok"; contentId: string };

function isTikTokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

/**
 * Content Agent — idea/script/hashtag generation is real (goes through the
 * shared AI provider, which itself is honest about REAL vs DEMO mode).
 * TikTok publishing is architecture-only: without TIKTOK_CLIENT_KEY/SECRET
 * it reports NOT_CONFIGURED and never claims to have published anything.
 */
export class ContentAgent implements Agent {
  readonly type = "CONTENT" as const;

  descriptor() {
    const tiktok = isTikTokConfigured();
    return baseDescriptor({
      type: this.type,
      name: "Content Agent",
      description: "Generates ideas, scripts, titles, descriptions and hashtags; prepares content for publishing.",
      status: "IDLE",
      capabilities: ["ideas", "scripts", "titles", "descriptions", "hashtags"],
      plannedCapabilities: tiktok ? ["publish to TikTok"] : ["publish to TikTok (needs TIKTOK_CLIENT_KEY/SECRET)"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as ContentAgentInput;
    const ai = getAIProvider();

    try {
      if (input.op === "generateIdeas") {
        const result = await ai.complete({
          system: "You are JARVIS's Content Agent. Produce short, punchy content ideas as a numbered list. No preamble.",
          messages: [{ role: "user", content: `Give me ${input.count ?? 5} short-form video ideas about: ${input.topic}` }],
        });
        return { success: true, mode: ai.mode === "REAL" ? "REAL" : "NOT_CONFIGURED", output: { ideas: result.text, provider: result.providerName, aiMode: result.mode } };
      }

      if (input.op === "writeScript") {
        const result = await ai.complete({
          system:
            "You are JARVIS's Content Agent. Write a short-form video script (30-60s) with a hook, body and CTA, " +
            "then a title, a description and 5 hashtags. Format as plain text with clear section labels.",
          messages: [{ role: "user", content: `Topic: ${input.topic}` }],
        });

        const item = await createContent({
          projectId: input.projectId ?? null,
          title: input.topic,
          platform: "tiktok",
          script: result.text,
          hashtags: extractHashtags(result.text),
        });

        return { success: true, mode: ai.mode === "REAL" ? "REAL" : "NOT_CONFIGURED", output: { content: item, provider: result.providerName, aiMode: result.mode } };
      }

      if (input.op === "publishTikTok") {
        if (!isTikTokConfigured()) {
          return {
            success: false,
            mode: "NOT_CONFIGURED",
            error: "TikTok publishing requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env.",
          };
        }
        const check = await enforceAction({ action: "content.publish", taskId: ctx.taskId, agentType: this.type, reason: `Publish content ${input.contentId} to TikTok` });
        if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };

        // Architecture is ready (OAuth + risk gate) but the TikTok Content
        // Posting API client isn't wired yet — never fake a publish.
        await updateContentState(input.contentId, "FAILED");
        return {
          success: false,
          mode: "NOT_CONFIGURED",
          error: "TikTok API client is not implemented yet. Marked content as FAILED rather than pretending to publish.",
        };
      }

      return { success: false, mode: "REAL", error: "Unknown Content Agent operation" };
    } catch (error) {
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g);
  return matches ? Array.from(new Set(matches)).slice(0, 10) : [];
}
