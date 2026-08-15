import { execFile } from "node:child_process";
import { WorkspaceSandbox } from "@jarvis/security";

export interface ShellExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Real shell execution, sandboxed to the workspace root and time-limited.
 * The caller (Developer Agent) is responsible for running this through the
 * security policy first — this class only enforces the *directory* sandbox. */
export class ShellTools {
  private readonly sandbox: WorkspaceSandbox;

  constructor(sandbox: WorkspaceSandbox) {
    this.sandbox = sandbox;
  }

  async exec(command: string, args: string[] = [], cwd = "."): Promise<ShellExecResult> {
    const workDir = this.sandbox.resolve(cwd);
    return new Promise((resolvePromise, reject) => {
      execFile(
        command,
        args,
        { cwd: workDir, timeout: DEFAULT_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && typeof (error as NodeJS.ErrnoException).code === "string" && (error as any).code === "ENOENT") {
            reject(new Error(`Command not found: ${command}`));
            return;
          }
          resolvePromise({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: (error as any)?.code ?? 0,
          });
        },
      );
    });
  }
}
