import { listDevices } from "@jarvis/db";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";
import type { ComputerCommand } from "./computer-protocol.js";

export interface ComputerAgentInput {
  userId: string;
  command: ComputerCommand;
}

/**
 * Computer Agent — architecture and protocol are real (see
 * computer-protocol.ts); actual execution requires a paired device daemon
 * running on the user's machine, which does not exist yet. This class is
 * honest about that: it never simulates a result, it reports NOT_CONNECTED.
 */
export class ComputerAgent implements Agent {
  readonly type = "COMPUTER" as const;

  descriptor() {
    return baseDescriptor({
      type: this.type,
      name: "Computer Agent",
      description: "Controls a paired local device (Mac) — open apps, run commands, take screenshots.",
      status: "NOT_CONNECTED",
      capabilities: [],
      plannedCapabilities: [
        "open applications",
        "execute authorized commands",
        "work with local files",
        "control local browser",
        "take screenshots",
      ],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const input = ctx.input as ComputerAgentInput;
    const devices = await listDevices(input.userId);
    const online = devices.find((d) => d.status === "ONLINE");

    if (!online) {
      return {
        success: false,
        mode: "NOT_CONNECTED",
        error:
          "No paired device is connected. The Computer Agent architecture and protocol are implemented " +
          "(see AGENTS.md), but no local daemon has been installed/paired yet.",
      };
    }

    // A real device would be dispatched to here over the WebSocket protocol
    // in computer-protocol.ts. No daemon implementation exists yet, so we
    // stop rather than fabricate a result even though a device row exists.
    return {
      success: false,
      mode: "NOT_CONNECTED",
      error: "Device pairing exists but the command dispatch transport is not implemented yet.",
    };
  }
}
