import type { ComputerCommandType } from "@jarvis/shared";
import { WorkspaceSandbox } from "@jarvis/security";
import { getSystemInfo } from "./system-info.js";
import { openApplication } from "./open-application.js";
import { openUrl } from "./open-url.js";
import { takeScreenshot } from "./screenshot.js";
import { FilesystemExecutor } from "./filesystem.js";
import { runCommand } from "./run-command.js";

export interface ExecuteCommandInput {
  type: ComputerCommandType;
  payload: Record<string, unknown>;
}

/** Dispatches a claimed command to its concrete executor. Every branch is
 * a real implementation for the current platform, or throws a clear error
 * naming exactly what's unsupported — never a fabricated success. */
export async function executeCommand(input: ExecuteCommandInput, sandbox: WorkspaceSandbox): Promise<unknown> {
  const platform = process.platform;
  const fsExecutor = new FilesystemExecutor(sandbox);

  switch (input.type) {
    case "SYSTEM_INFO":
      return getSystemInfo();

    case "OPEN_APPLICATION":
      return openApplication(String(input.payload.application ?? ""), platform);

    case "OPEN_URL":
      return openUrl(String(input.payload.url ?? ""), platform);

    case "SCREENSHOT":
      return takeScreenshot(platform);

    case "LIST_DIRECTORY":
      return fsExecutor.listDirectory(typeof input.payload.path === "string" ? input.payload.path : ".");

    case "READ_FILE":
      return fsExecutor.readFile(String(input.payload.path ?? ""));

    case "WRITE_FILE":
      return fsExecutor.writeFile(String(input.payload.path ?? ""), String(input.payload.content ?? ""));

    case "CREATE_DIRECTORY":
      return fsExecutor.createDirectory(String(input.payload.path ?? ""));

    case "RUN_COMMAND": {
      const command = String(input.payload.command ?? "");
      const args = Array.isArray(input.payload.args) ? input.payload.args.map(String) : [];
      const cwd = typeof input.payload.cwd === "string" ? input.payload.cwd : ".";
      return runCommand(command, args, cwd, sandbox);
    }

    default: {
      const exhaustive: never = input.type;
      throw new Error(`Unknown command type: ${exhaustive}`);
    }
  }
}
