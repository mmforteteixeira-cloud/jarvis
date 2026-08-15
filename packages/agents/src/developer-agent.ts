import { FsTools, ShellTools } from "@jarvis/tools";
import { WorkspaceSandbox, enforceAction } from "@jarvis/security";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

const SAFE_TEST_COMMANDS = new Set(["npm", "pnpm", "node", "git", "python3", "vitest"]);

export type DeveloperAgentInput =
  | { op: "writeFile"; path: string; content: string }
  | { op: "readFile"; path: string }
  | { op: "runCommand"; command: string; args?: string[]; cwd?: string };

/** Real Developer Agent: sandboxed file + shell access for working on a project. */
export class DeveloperAgent implements Agent {
  readonly type = "DEVELOPER" as const;
  private readonly fs: FsTools;
  private readonly shell: ShellTools;
  private readonly sandbox: WorkspaceSandbox;

  constructor(workspaceRoot: string) {
    this.sandbox = new WorkspaceSandbox(workspaceRoot);
    this.fs = new FsTools({ sandbox: this.sandbox });
    this.shell = new ShellTools(this.sandbox);
  }

  descriptor() {
    return baseDescriptor({
      type: this.type,
      name: "Developer Agent",
      description: "Writes code, runs commands and tests inside the sandboxed project workspace.",
      status: "IDLE",
      capabilities: ["write files", "read files", "run whitelisted commands (npm/pnpm/git/node/python3/vitest)"],
      plannedCapabilities: ["debugging with stack-trace analysis", "multi-file refactors", "PR creation"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as DeveloperAgentInput;
    try {
      switch (input.op) {
        case "writeFile": {
          const check = await enforceAction({ action: "file.write.workspace", taskId: ctx.taskId, agentType: this.type, reason: `Write ${input.path}` });
          if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
          await this.fs.writeFile(input.path, input.content);
          return { success: true, mode: "REAL", output: { written: input.path } };
        }
        case "readFile": {
          const content = await this.fs.readFile(input.path);
          return { success: true, mode: "REAL", output: { content } };
        }
        case "runCommand": {
          const isSafe = SAFE_TEST_COMMANDS.has(input.command);
          const action = isSafe ? "shell.exec.test" : "shell.exec.general";
          const check = await enforceAction({
            action,
            taskId: ctx.taskId,
            agentType: this.type,
            reason: `Run: ${input.command} ${(input.args ?? []).join(" ")}`,
          });
          if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
          const result = await this.shell.exec(input.command, input.args ?? [], input.cwd ?? ".");
          return { success: result.exitCode === 0, mode: "REAL", output: result };
        }
        default:
          return { success: false, mode: "REAL", error: "Unknown Developer Agent operation" };
      }
    } catch (error) {
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
