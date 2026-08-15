import { createLogger } from "@jarvis/shared";
import { WorkspaceSandbox } from "@jarvis/security";
import type { ComputerCommandRecord } from "@jarvis/shared";
import type { JarvisServerClient } from "./client.js";
import { executeCommand } from "./executors/index.js";
import { PolicyRejectionError } from "./errors.js";
import { daemonState } from "./daemon-state.js";

const logger = createLogger("computer-agent:poller");

export class Poller {
  private readonly sandbox: WorkspaceSandbox;
  private stopped = false;

  constructor(
    private readonly client: JarvisServerClient,
    workspaceRoot: string,
  ) {
    this.sandbox = new WorkspaceSandbox(workspaceRoot);
  }

  stop() {
    this.stopped = true;
  }

  /** One poll cycle: ask the server for the next queued command, execute
   * it if there is one. Every error is caught here — a bad command must
   * never crash the daemon's loop. */
  async tick(): Promise<void> {
    if (this.stopped) return;

    let command: ComputerCommandRecord | null;
    try {
      command = await this.client.nextCommand();
    } catch (error) {
      logger.warn("Failed to poll for commands", { error: (error as Error).message });
      return;
    }

    if (!command) return;

    daemonState.setState("BUSY");
    logger.info("Executing command", { id: command.id, type: command.type });

    try {
      const result = await executeCommand({ type: command.type, payload: command.payload }, this.sandbox);
      await this.client.postResult(command.id, { state: "COMPLETED", result });
      logger.info("Command completed", { id: command.id, type: command.type });
    } catch (error) {
      const isRejection = error instanceof PolicyRejectionError;
      const message = error instanceof Error ? error.message : String(error);
      await this.client
        .postResult(command.id, { state: isRejection ? "REJECTED" : "FAILED", error: message })
        .catch((postError) => logger.error("Failed to report command result", { error: (postError as Error).message }));
      logger[isRejection ? "warn" : "error"](`Command ${isRejection ? "rejected" : "failed"}`, {
        id: command.id,
        type: command.type,
        error: message,
      });
    } finally {
      daemonState.recordCommand();
      daemonState.setState("ONLINE");
    }
  }
}
