import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const execFileAsync = promisify(execFile);

export interface ScreenshotResult {
  base64: string;
  mimeType: "image/png";
}

/** Captures to a temp file and deletes it immediately after reading it
 * into memory — no screenshot is ever kept on disk longer than the single
 * command's execution. "Não guardar screenshots indefinidamente" taken
 * literally: retention is zero, not "for a while". */
export async function takeScreenshot(platform: NodeJS.Platform): Promise<ScreenshotResult> {
  const tmpPath = resolve(tmpdir(), `jarvis-screenshot-${randomUUID()}.png`);

  try {
    if (platform === "darwin") {
      // -x: no camera shutter sound.
      await execFileAsync("screencapture", ["-x", tmpPath]);
    } else if (platform === "linux") {
      await captureOnLinux(tmpPath);
    } else {
      throw new Error(`SCREENSHOT is not implemented for platform "${platform}" yet.`);
    }

    const buffer = await readFile(tmpPath);
    return { base64: buffer.toString("base64"), mimeType: "image/png" };
  } finally {
    await unlink(tmpPath).catch(() => {
      // Nothing to clean up if capture failed before the file was written.
    });
  }
}

async function captureOnLinux(tmpPath: string): Promise<void> {
  const attempts: Array<[string, string[]]> = [
    ["scrot", [tmpPath]],
    ["import", ["-window", "root", tmpPath]],
    ["gnome-screenshot", ["-f", tmpPath]],
  ];
  let lastError: Error | null = null;
  for (const [cmd, args] of attempts) {
    try {
      await execFileAsync(cmd, args, { timeout: 5000 });
      return;
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw new Error(
    `No screenshot utility available (tried scrot/import/gnome-screenshot) or no display attached: ${lastError?.message ?? "unknown error"}`,
  );
}
