import type { ComputerCommandType } from "@jarvis/shared";

/**
 * Computer Agent communication protocol — v0.2, now actually implemented
 * end to end (see `apps/computer-agent` for the daemon and
 * `apps/web/app/api/computer/device/*` for the server side).
 *
 * Transport: plain HTTP polling over localhost (or LAN/HTTPS in a future
 * remote deployment), not WebSocket. The architecture diagram in the
 * product spec describes a "COMMAND QUEUE" the daemon pulls from — a poll
 * loop against a REST API implements that queue directly, with far less
 * moving-parts risk than a bidirectional socket, and is trivial to smoke
 * test with `curl`. `ComputerAgentEnvelope` below is kept as a
 * WebSocket-shaped type so a future push-based transport is a drop-in
 * replacement, not a redesign — but nothing implements it today.
 *
 * Design goals (unchanged from v0.1's placeholder):
 *  - The daemon authenticates with a pre-shared secret (COMPUTER_AGENT_TOKEN),
 *    never with the user's OS credentials.
 *  - Every command passes through the same LOW/MEDIUM/HIGH risk approval
 *    flow as any other agent (@jarvis/security's enforceAction) — the
 *    daemon is a remote executor, not a bypass.
 *  - The daemon independently re-validates every command against
 *    @jarvis/security's computer-policy (allowlist, sandbox, blocked shell
 *    patterns) before running it, regardless of what risk level the server
 *    attached — JARVIS Core cannot force it to do something it wasn't
 *    configured to allow.
 */

export type ComputerAgentMessageType =
  | "PAIR_REQUEST"
  | "PAIR_ACCEPTED"
  | "HEARTBEAT"
  | "COMMAND_REQUEST"
  | "COMMAND_RESULT"
  | "ERROR";

/** Reserved for a future WebSocket/push transport — not used by the
 * current HTTP-polling implementation. */
export interface ComputerAgentEnvelope<T = unknown> {
  type: ComputerAgentMessageType;
  deviceId: string;
  requestId: string;
  timestamp: string;
  payload: T;
}

// ---------------------------------------------------------------------------
// HTTP DTOs — what the daemon actually sends/receives today
// ---------------------------------------------------------------------------

export interface DeviceRegisterRequest {
  externalId: string;
  name: string;
  platform: "darwin" | "win32" | "linux";
  architecture: string;
  agentVersion: string;
}

export interface DeviceRegisterResponse {
  deviceId: string;
  status: string;
}

export interface DeviceHeartbeatRequest {
  externalId: string;
  status: "ONLINE" | "BUSY";
  agentVersion: string;
}

export interface CommandResultRequest {
  state: "COMPLETED" | "FAILED" | "REJECTED";
  result?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Command payloads, one per ComputerCommandType (@jarvis/shared)
// ---------------------------------------------------------------------------

export interface SystemInfoPayload {}

export interface OpenApplicationPayload {
  application: string;
}

export interface OpenUrlPayload {
  url: string;
}

export interface ScreenshotPayload {}

export interface ListDirectoryPayload {
  path?: string;
}

export interface ReadFilePayload {
  path: string;
}

export interface WriteFilePayload {
  path: string;
  content: string;
}

export interface CreateDirectoryPayload {
  path: string;
}

export interface RunCommandPayload {
  command: string;
  args?: string[];
  cwd?: string;
}

export type ComputerCommandPayloadFor<T extends ComputerCommandType> = T extends "SYSTEM_INFO"
  ? SystemInfoPayload
  : T extends "OPEN_APPLICATION"
    ? OpenApplicationPayload
    : T extends "OPEN_URL"
      ? OpenUrlPayload
      : T extends "SCREENSHOT"
        ? ScreenshotPayload
        : T extends "LIST_DIRECTORY"
          ? ListDirectoryPayload
          : T extends "READ_FILE"
            ? ReadFilePayload
            : T extends "WRITE_FILE"
              ? WriteFilePayload
              : T extends "CREATE_DIRECTORY"
                ? CreateDirectoryPayload
                : T extends "RUN_COMMAND"
                  ? RunCommandPayload
                  : never;

export interface SystemInfoResult {
  os: string;
  release: string;
  architecture: string;
  hostnameHash: string; // hashed, not the raw hostname — see daemon/src/executors/system-info.ts
  agentVersion: string;
}
