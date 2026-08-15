import type { ComputerCommandRecord } from "@jarvis/shared";
import { createLogger } from "@jarvis/shared";
import type { DaemonConfig } from "./config.js";
import { AGENT_VERSION, type DeviceIdentity } from "./device-identity.js";

const logger = createLogger("computer-agent:client");

export class JarvisServerClient {
  constructor(
    private readonly config: DaemonConfig,
    private readonly identity: DeviceIdentity,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.config.token) {
      throw new Error("COMPUTER_AGENT_TOKEN is not set — cannot authenticate with the JARVIS server.");
    }
    const res = await fetch(`${this.config.serverUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`JARVIS server ${path} responded ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async register(): Promise<{ deviceId: string; status: string }> {
    return this.request("/api/computer/device/register", {
      method: "POST",
      body: JSON.stringify({
        externalId: this.identity.externalId,
        name: this.config.deviceName,
        platform: this.identity.platform,
        architecture: this.identity.architecture,
        agentVersion: AGENT_VERSION,
      }),
    });
  }

  async heartbeat(status: "ONLINE" | "BUSY"): Promise<void> {
    await this.request("/api/computer/device/heartbeat", {
      method: "POST",
      body: JSON.stringify({ externalId: this.identity.externalId, status, agentVersion: AGENT_VERSION }),
    });
  }

  async nextCommand(): Promise<ComputerCommandRecord | null> {
    const res = await this.request<{ command: ComputerCommandRecord | null }>(
      `/api/computer/device/commands/next?externalId=${encodeURIComponent(this.identity.externalId)}`,
    );
    return res.command;
  }

  async postResult(commandId: string, result: { state: "COMPLETED" | "FAILED" | "REJECTED"; result?: unknown; error?: string }): Promise<void> {
    await this.request(`/api/computer/device/commands/${commandId}/result`, {
      method: "POST",
      body: JSON.stringify(result),
    });
  }

  async announceOffline(): Promise<void> {
    try {
      await this.request("/api/computer/device/offline", {
        method: "POST",
        body: JSON.stringify({ externalId: this.identity.externalId }),
      });
    } catch (error) {
      logger.warn("Could not announce offline status (server may already be down)", { error: (error as Error).message });
    }
  }
}
