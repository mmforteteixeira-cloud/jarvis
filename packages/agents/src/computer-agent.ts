import { createComputerCommand, getComputerCommand, listDevices, reapStaleDevices } from "@jarvis/db";
import {
  classifyAppOpen,
  classifyShellCommand,
  enforceAction,
  isSafeUrl,
  isSensitivePath,
  toRiskLevel,
} from "@jarvis/security";
import type { ComputerCommandType } from "@jarvis/shared";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";
import type {
  OpenApplicationPayload,
  OpenUrlPayload,
  ReadFilePayload,
  RunCommandPayload,
  WriteFilePayload,
} from "./computer-protocol.js";

export interface ComputerAgentInput {
  type: ComputerCommandType;
  payload: Record<string, unknown>;
}

const POLL_INTERVAL_MS = 300;
const DEFAULT_WAIT_MS = 20_000;

/**
 * Computer Agent — real dispatch to a paired local daemon (see
 * apps/computer-agent). Risk classification happens twice, independently:
 * here (server-side, before the command is even queued — this is what
 * decides whether JARVIS asks for your approval) and again inside the
 * daemon itself right before it executes (see computer-policy.ts +
 * apps/computer-agent/src/policy.ts) — the daemon never trusts that
 * "the server already checked".
 */
export interface ComputerAgentOptions {
  /** Overrides how long execute() waits for the daemon to complete a
   * queued command before giving up honestly. Mainly for tests — real
   * usage wants the full default. */
  maxWaitMs?: number;
}

export class ComputerAgent implements Agent {
  readonly type = "COMPUTER" as const;

  constructor(private readonly options: ComputerAgentOptions = {}) {}

  descriptor() {
    return baseDescriptor({
      type: this.type,
      name: "Computer Agent",
      description: "Controls a paired local device (Mac) — open apps, run commands, take screenshots.",
      status: "NOT_CONNECTED",
      capabilities: [],
      plannedCapabilities: [
        "open applications",
        "open URLs",
        "take screenshots",
        "list/read/write files in a sandboxed workspace",
        "run allow-listed commands",
      ],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as ComputerAgentInput;

    await reapStaleDevices(ctx.userId);
    const devices = await listDevices(ctx.userId);
    const online = devices.find((d) => d.status === "ONLINE" || d.status === "BUSY");

    if (!online) {
      return {
        success: false,
        mode: "NOT_CONNECTED",
        error: "Computer Agent is offline. No paired device has a recent heartbeat — start the daemon (apps/computer-agent) on your Mac.",
      };
    }

    // Pre-execution policy: catches outright refusals (unknown app,
    // unsafe URL scheme, blocked shell command, sensitive file path)
    // before we even ask for approval — there's nothing to approve for
    // "no", only for "yes, but you must confirm".
    const rejection = this.checkOutrightRejection(input);
    if (rejection) {
      return { success: false, mode: "REAL", error: rejection };
    }

    const { action, riskLevel, reason } = this.classify(input);
    const check = await enforceAction({
      action,
      riskLevel,
      taskId: ctx.taskId,
      agentType: this.type,
      reason,
    });
    if (!check.allowed) {
      return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
    }

    const command = await createComputerCommand({
      deviceId: online.id,
      taskId: ctx.taskId,
      type: input.type,
      payload: input.payload,
      riskLevel: check.riskLevel,
    });

    return this.waitForResult(command.id, this.options.maxWaitMs ?? DEFAULT_WAIT_MS);
  }

  /** Refusals that don't go through the approval flow at all — the answer
   * is always no, asking wouldn't change that. */
  private checkOutrightRejection(input: ComputerAgentInput): string | null {
    switch (input.type) {
      case "OPEN_APPLICATION": {
        const app = (input.payload as unknown as OpenApplicationPayload).application;
        const classification = classifyAppOpen(app);
        if (!classification.allowed) {
          return `"${app}" is not on the application allowlist. JARVIS only opens known, allow-listed apps — see AGENTS.md.`;
        }
        return null;
      }
      case "OPEN_URL": {
        const url = (input.payload as unknown as OpenUrlPayload).url;
        if (!isSafeUrl(url)) {
          return `"${url}" is not a safe URL (only http/https are allowed).`;
        }
        return null;
      }
      case "READ_FILE": {
        const path = (input.payload as unknown as ReadFilePayload).path;
        if (isSensitivePath(path)) {
          return `Refusing to read "${path}" — it looks like a credential/secret file.`;
        }
        return null;
      }
      case "WRITE_FILE": {
        const path = (input.payload as unknown as WriteFilePayload).path;
        if (isSensitivePath(path)) {
          return `Refusing to write "${path}" — it looks like a credential/secret file.`;
        }
        return null;
      }
      case "RUN_COMMAND": {
        const { command, args } = input.payload as unknown as RunCommandPayload;
        if (classifyShellCommand(command, args ?? []) === "BLOCKED") {
          return `Refusing to run "${command}" — it matches a blocked command pattern (see computer-policy.ts).`;
        }
        return null;
      }
      default:
        return null;
    }
  }

  private classify(input: ComputerAgentInput): { action: string; riskLevel: ReturnType<typeof toRiskLevel>; reason: string } {
    switch (input.type) {
      case "SYSTEM_INFO":
        return { action: "computer.system_info", riskLevel: "LOW_RISK", reason: "Read basic system info" };
      case "OPEN_APPLICATION": {
        const app = (input.payload as unknown as OpenApplicationPayload).application;
        return { action: "computer.open_app", riskLevel: "LOW_RISK", reason: `Open application: ${app}` };
      }
      case "OPEN_URL": {
        const url = (input.payload as unknown as OpenUrlPayload).url;
        return { action: "computer.open_url", riskLevel: "LOW_RISK", reason: `Open URL: ${url}` };
      }
      case "SCREENSHOT":
        return { action: "computer.screenshot", riskLevel: "LOW_RISK", reason: "Capture a screenshot" };
      case "LIST_DIRECTORY":
        return { action: "computer.list_directory", riskLevel: "LOW_RISK", reason: "List directory contents" };
      case "READ_FILE":
        return { action: "computer.read_file", riskLevel: "LOW_RISK", reason: "Read a file" };
      case "WRITE_FILE":
        return { action: "computer.write_file", riskLevel: "LOW_RISK", reason: "Write a file" };
      case "CREATE_DIRECTORY":
        return { action: "computer.create_directory", riskLevel: "LOW_RISK", reason: "Create a directory" };
      case "RUN_COMMAND": {
        const { command, args } = input.payload as unknown as RunCommandPayload;
        const computerRisk = classifyShellCommand(command, args ?? []);
        // BLOCKED already short-circuited in checkOutrightRejection.
        const riskLevel = toRiskLevel(computerRisk as "LOW" | "MEDIUM" | "HIGH");
        return { action: "computer.run_command", riskLevel, reason: `Run: ${command} ${(args ?? []).join(" ")}` };
      }
    }
  }

  private async waitForResult(commandId: string, maxWaitMs = DEFAULT_WAIT_MS): Promise<AgentExecutionResult> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const command = await getComputerCommand(commandId);
      if (!command) return { success: false, mode: "REAL", error: "Command vanished before completion." };

      if (command.state === "COMPLETED") {
        return { success: true, mode: "REAL", output: command.result };
      }
      if (command.state === "FAILED") {
        return { success: false, mode: "REAL", error: command.error ?? "Computer Agent reported failure." };
      }
      if (command.state === "REJECTED") {
        return { success: false, mode: "REAL", error: command.error ?? "The daemon's local policy rejected this command." };
      }
      if (command.state === "EXPIRED") {
        return { success: false, mode: "REAL", error: "Command expired before the daemon picked it up." };
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return {
      success: false,
      mode: "REAL",
      error: `Computer Agent did not respond within ${maxWaitMs / 1000}s. The command may still complete — check the Computer page.`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
