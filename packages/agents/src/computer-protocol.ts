/**
 * Computer Agent communication protocol (architecture only — no device is
 * connected yet). This is the contract a future local daemon, installed on
 * the user's Mac, would speak over a WebSocket back to JARVIS Core.
 *
 * Design goals:
 *  - The daemon authenticates with a pre-shared secret (COMPUTER_AGENT_TOKEN),
 *    never with the user's OS credentials.
 *  - Every command the daemon is asked to run passes back through the same
 *    LOW/MEDIUM/HIGH risk approval flow as any other agent — the daemon is a
 *    remote executor, not a bypass.
 *  - The daemon is the one deciding what it's willing to do locally
 *    (allow-list of app names, workspace directories, etc.) — JARVIS Core
 *    cannot force it to do something it wasn't configured to allow.
 */

export type ComputerAgentMessageType =
  | "PAIR_REQUEST"
  | "PAIR_ACCEPTED"
  | "HEARTBEAT"
  | "COMMAND_REQUEST"
  | "COMMAND_RESULT"
  | "SCREENSHOT_REQUEST"
  | "SCREENSHOT_RESULT"
  | "ERROR";

export interface ComputerAgentEnvelope<T = unknown> {
  type: ComputerAgentMessageType;
  deviceId: string;
  requestId: string;
  timestamp: string;
  payload: T;
}

export interface PairRequestPayload {
  token: string; // must equal COMPUTER_AGENT_TOKEN
  deviceName: string;
  platform: "darwin" | "win32" | "linux";
}

export type ComputerCommand =
  | { kind: "open_app"; appName: string }
  | { kind: "run_shell"; command: string; args: string[] }
  | { kind: "read_file"; path: string }
  | { kind: "write_file"; path: string; content: string }
  | { kind: "screenshot" }
  | { kind: "browser_control"; action: string; params: Record<string, unknown> };

export interface CommandRequestPayload {
  command: ComputerCommand;
  riskLevel: "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";
  approvedPermissionId?: string;
}

export interface CommandResultPayload {
  success: boolean;
  output?: unknown;
  error?: string;
}
