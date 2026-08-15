import { createHash } from "node:crypto";
import { hostname, platform, release, arch } from "node:os";
import { AGENT_VERSION } from "../device-identity.js";

// Mirrors @jarvis/agents' SystemInfoResult (packages/agents/src/computer-protocol.ts)
// — duplicated rather than imported so this daemon doesn't have to pull in
// @jarvis/agents' heavier transitive dependencies (playwright, googleapis)
// just for one type shape.
export interface SystemInfoResult {
  os: string;
  release: string;
  architecture: string;
  hostnameHash: string;
  agentVersion: string;
}

/** Hostnames are often personally identifying ("Johns-MacBook-Pro.local")
 * — hash it rather than sending it verbatim. Still useful for the daemon
 * operator to confirm "yes, that's my machine" without JARVIS Core (or
 * anything that logs its responses) ever seeing the literal name. */
export function getSystemInfo(): SystemInfoResult {
  return {
    os: platform(),
    release: release(),
    architecture: arch(),
    hostnameHash: createHash("sha256").update(hostname()).digest("hex").slice(0, 16),
    agentVersion: AGENT_VERSION,
  };
}
