import { execFile } from "node:child_process";
import { classifyShellCommand, type WorkspaceSandbox } from "@jarvis/security";
import { PolicyRejectionError } from "../errors.js";

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 5 * 1024 * 1024;

/**
 * Final, independent policy check before actually spawning a process —
 * the server already classified this command's risk before queuing it,
 * but the daemon re-derives that classification itself rather than
 * trusting the queued riskLevel field.
 */
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  sandbox: WorkspaceSandbox,
): Promise<RunCommandResult> {
  if (classifyShellCommand(command, args) === "BLOCKED") {
    throw new PolicyRejectionError(`Refusing to run "${command}" — it matches a blocked command pattern.`);
  }

  let workDir: string;
  try {
    workDir = sandbox.resolve(cwd || ".");
  } catch (error) {
    throw new PolicyRejectionError((error as Error).message);
  }

  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd: workDir, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(`Command not found: ${command}`));
        return;
      }
      resolvePromise({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: (error as { code?: number } | null)?.code ?? 0,
      });
    });
  });
}
