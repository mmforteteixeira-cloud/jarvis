import { webSearch } from "@jarvis/tools";
import { IntegrationNotConfiguredError } from "@jarvis/shared";
import { enforceAction } from "@jarvis/security";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

export interface ResearchAgentInput {
  query: string;
  limit?: number;
}

/** Real Research Agent — web search via SEARCH_API_KEY, no fabricated results. */
export class ResearchAgent implements Agent {
  readonly type = "RESEARCH" as const;

  descriptor() {
    const configured = Boolean(process.env.SEARCH_API_KEY);
    return baseDescriptor({
      type: this.type,
      name: "Research Agent",
      description: "Searches the web and produces structured, summarized findings.",
      status: configured ? "IDLE" : "NOT_CONFIGURED",
      capabilities: configured ? ["web search", "result aggregation"] : [],
      plannedCapabilities: ["multi-source synthesis", "citation tracking", "deep research reports"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as ResearchAgentInput;
    const check = await enforceAction({ action: "research.search", taskId: ctx.taskId, agentType: this.type, reason: `Search: ${input.query}` });
    if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };

    try {
      const results = await webSearch(input.query, input.limit ?? 5);
      return { success: true, mode: "REAL", output: { query: input.query, results } };
    } catch (error) {
      if (error instanceof IntegrationNotConfiguredError) {
        return { success: false, mode: "NOT_CONFIGURED", error: error.message };
      }
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
