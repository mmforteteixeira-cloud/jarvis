import { hostname } from "node:os";
import { resolve } from "node:path";
import { homedir } from "node:os";

export interface DaemonConfig {
  enabled: boolean;
  port: number;
  workspaceRoot: string;
  token: string | null;
  serverUrl: string;
  deviceName: string;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

export function loadConfig(): DaemonConfig {
  return {
    enabled: (process.env.COMPUTER_AGENT_ENABLED ?? "false").toLowerCase() === "true",
    port: Number(process.env.COMPUTER_AGENT_PORT ?? 8787),
    workspaceRoot: resolve(expandHome(process.env.COMPUTER_AGENT_WORKSPACE ?? "~/JARVIS/workspace")),
    token: process.env.COMPUTER_AGENT_TOKEN || null,
    serverUrl: (process.env.JARVIS_SERVER_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    deviceName: process.env.COMPUTER_AGENT_DEVICE_NAME || hostname(),
    pollIntervalMs: Number(process.env.COMPUTER_AGENT_POLL_INTERVAL_MS ?? 2000),
    heartbeatIntervalMs: Number(process.env.COMPUTER_AGENT_HEARTBEAT_INTERVAL_MS ?? 15000),
  };
}
