import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { classifyAppOpen } from "@jarvis/security";
import { PolicyRejectionError } from "../errors.js";

const execFileAsync = promisify(execFile);

export interface OpenApplicationResult {
  application: string;
  launched: boolean;
}

/**
 * Opens an allow-listed application. The allowlist check already happened
 * server-side (ComputerAgent.checkOutrightRejection) before this command
 * was ever queued — this re-checks independently, because the daemon
 * never trusts "the server already validated this".
 */
export async function openApplication(applicationName: string, platform: NodeJS.Platform): Promise<OpenApplicationResult> {
  const classification = classifyAppOpen(applicationName);
  if (!classification.allowed || !classification.app) {
    throw new PolicyRejectionError(`"${applicationName}" is not on the local application allowlist.`);
  }
  const app = classification.app;

  if (platform === "darwin") {
    await execFileAsync("open", ["-a", app.macApp]);
    return { application: app.label, launched: true };
  }

  if (platform === "linux") {
    if (!app.linuxCommand) {
      throw new Error(`${app.label} has no configured Linux launch command.`);
    }
    // Detached: GUI apps shouldn't block the daemon's event loop, and we
    // don't want their stdout/stderr piped into ours.
    await execFileAsync(app.linuxCommand, [], { timeout: 5000 }).catch((error) => {
      // A GUI app with no $DISPLAY (e.g. this headless dev sandbox) fails
      // fast and predictably — surface that honestly instead of hiding it.
      throw new Error(`Failed to launch ${app.label} via "${app.linuxCommand}": ${(error as Error).message}`);
    });
    return { application: app.label, launched: true };
  }

  throw new Error(`OPEN_APPLICATION is not implemented for platform "${platform}" yet.`);
}
