import { randomUUID } from "node:crypto";
import { arch, homedir, platform } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const AGENT_VERSION = "0.1.0";

export interface DeviceIdentity {
  externalId: string;
  platform: "darwin" | "win32" | "linux";
  architecture: string;
}

const IDENTITY_DIR = resolve(homedir(), ".jarvis");
const IDENTITY_FILE = resolve(IDENTITY_DIR, "device.json");

function detectPlatform(): "darwin" | "win32" | "linux" {
  const p = platform();
  if (p === "darwin" || p === "win32" || p === "linux") return p;
  return "linux"; // closest fallback for other POSIX systems
}

/**
 * A stable device id, generated once and persisted locally
 * (~/.jarvis/device.json) so the daemon re-registers as the *same* device
 * across restarts instead of creating a new row in JARVIS every time it
 * starts up. Contains no personal information — just a random UUID.
 */
export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  if (existsSync(IDENTITY_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(IDENTITY_FILE, "utf-8"));
      if (typeof parsed.externalId === "string" && parsed.externalId.length > 0) {
        return { externalId: parsed.externalId, platform: detectPlatform(), architecture: arch() };
      }
    } catch {
      // fall through to regenerate — a corrupt identity file shouldn't block startup
    }
  }

  const identity: DeviceIdentity = { externalId: randomUUID(), platform: detectPlatform(), architecture: arch() };
  mkdirSync(IDENTITY_DIR, { recursive: true });
  writeFileSync(IDENTITY_FILE, JSON.stringify({ externalId: identity.externalId }, null, 2), "utf-8");
  return identity;
}
