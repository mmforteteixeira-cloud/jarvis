import { FsTools } from "@jarvis/tools";
import { WorkspaceSandbox, enforceAction } from "@jarvis/security";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

export type FileAgentInput =
  | { op: "read"; path: string }
  | { op: "list"; path?: string }
  | { op: "write"; path: string; content: string }
  | { op: "search"; query: string; path?: string }
  | { op: "delete"; path: string };

/** Real File Agent, sandboxed to a single workspace directory. */
export class FileAgent implements Agent {
  readonly type = "FILE" as const;
  private readonly tools: FsTools;
  private readonly sandbox: WorkspaceSandbox;

  constructor(workspaceRoot: string) {
    this.sandbox = new WorkspaceSandbox(workspaceRoot);
    this.tools = new FsTools({ sandbox: this.sandbox });
  }

  descriptor() {
    return baseDescriptor({
      type: this.type,
      name: "File Agent",
      description: "Reads, writes, searches and organizes files inside the JARVIS workspace sandbox.",
      status: "IDLE",
      capabilities: ["read files", "write files (workspace)", "list directories", "search files"],
      plannedCapabilities: ["organize files across projects", "diff-based editing"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as FileAgentInput;
    try {
      switch (input.op) {
        case "read": {
          const check = await enforceAction({ action: "file.read", taskId: ctx.taskId, agentType: this.type, reason: `Read ${input.path}` });
          if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
          const content = await this.tools.readFile(input.path);
          return { success: true, mode: "REAL", output: { content } };
        }
        case "list": {
          const entries = await this.tools.listDir(input.path ?? ".");
          return { success: true, mode: "REAL", output: { entries } };
        }
        case "write": {
          const check = await enforceAction({ action: "file.write.workspace", taskId: ctx.taskId, agentType: this.type, reason: `Write ${input.path}` });
          if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
          await this.tools.writeFile(input.path, input.content);
          return { success: true, mode: "REAL", output: { written: input.path } };
        }
        case "search": {
          const matches = await this.tools.searchFiles(input.query, input.path ?? ".");
          return { success: true, mode: "REAL", output: { matches } };
        }
        case "delete": {
          const check = await enforceAction({
            action: "file.delete",
            taskId: ctx.taskId,
            agentType: this.type,
            reason: `Delete ${input.path} — irreversible.`,
          });
          if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
          // Deletion executes only once explicitly approved by resubmitting after approval.
          const { unlink } = await import("node:fs/promises");
          await unlink(this.sandbox.resolve(input.path));
          return { success: true, mode: "REAL", output: { deleted: input.path } };
        }
        default:
          return { success: false, mode: "REAL", error: `Unknown File Agent operation` };
      }
    } catch (error) {
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
