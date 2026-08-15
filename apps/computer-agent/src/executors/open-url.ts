import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isSafeUrl } from "@jarvis/security";
import { PolicyRejectionError } from "../errors.js";

const execFileAsync = promisify(execFile);

export interface OpenUrlResult {
  url: string;
  opened: boolean;
}

export async function openUrl(url: string, platform: NodeJS.Platform): Promise<OpenUrlResult> {
  if (!isSafeUrl(url)) {
    throw new PolicyRejectionError(`"${url}" is not a safe URL (only http/https are allowed).`);
  }

  if (platform === "darwin") {
    await execFileAsync("open", [url]);
    return { url, opened: true };
  }
  if (platform === "linux") {
    await execFileAsync("xdg-open", [url], { timeout: 5000 }).catch((error) => {
      throw new Error(`Failed to open URL via xdg-open (no browser/$DISPLAY?): ${(error as Error).message}`);
    });
    return { url, opened: true };
  }

  throw new Error(`OPEN_URL is not implemented for platform "${platform}" yet.`);
}
