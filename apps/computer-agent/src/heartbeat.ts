import { createLogger } from "@jarvis/shared";
import type { JarvisServerClient } from "./client.js";
import { daemonState } from "./daemon-state.js";

const logger = createLogger("computer-agent:heartbeat");

export async function sendHeartbeat(client: JarvisServerClient): Promise<void> {
  const current = daemonState.get();
  const status = current.state === "BUSY" ? "BUSY" : "ONLINE";
  try {
    await client.heartbeat(status);
    if (current.state !== "BUSY") daemonState.setState("ONLINE");
  } catch (error) {
    daemonState.setState("ERROR", (error as Error).message);
    logger.warn("Heartbeat failed", { error: (error as Error).message });
  }
}
