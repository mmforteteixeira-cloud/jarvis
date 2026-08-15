import { BrowserTools } from "@jarvis/tools";
import { enforceAction } from "@jarvis/security";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

export type BrowserAgentInput = { op: "navigate"; url: string } | { op: "screenshot"; url: string };

/** Real Browser Agent — headless Chromium via Playwright. Interaction
 * (clicking/typing/form-submission) is architected but not yet exposed:
 * it needs MEDIUM_RISK approval plumbing per-step, which is future work. */
export class BrowserAgent implements Agent {
  readonly type = "BROWSER" as const;
  private readonly tools = new BrowserTools();

  descriptor() {
    return baseDescriptor({
      type: this.type,
      name: "Browser Agent",
      description: "Navigates and reads web pages using a real headless browser.",
      status: "IDLE",
      capabilities: ["open pages", "read page content", "screenshots"],
      plannedCapabilities: ["click/type/form interaction", "multi-step authenticated sessions", "PDF export"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as BrowserAgentInput;
    try {
      if (input.op === "navigate") {
        const check = await enforceAction({ action: "browser.navigate", taskId: ctx.taskId, agentType: this.type, reason: `Navigate to ${input.url}` });
        if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
        const result = await this.tools.navigateAndRead(input.url);
        return { success: true, mode: "REAL", output: result };
      }
      if (input.op === "screenshot") {
        const check = await enforceAction({ action: "browser.screenshot", taskId: ctx.taskId, agentType: this.type, reason: `Screenshot ${input.url}` });
        if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
        const png = await this.tools.screenshot(input.url);
        return { success: true, mode: "REAL", output: { base64: png.toString("base64") } };
      }
      return { success: false, mode: "REAL", error: "Unknown Browser Agent operation" };
    } catch (error) {
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
