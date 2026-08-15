import { setSetting } from "@jarvis/db";
import { createLogger } from "@jarvis/shared";

const logger = createLogger("worker:heartbeat");
const startedAt = Date.now();

export interface HeartbeatPayload {
  pid: number;
  startedAt: string;
  lastBeatAt: string;
  uptimeMs: number;
}

/** Records liveness so the UI (or an external monitor) can tell the worker
 * is actually running, not just that the process table has an entry. */
export async function beat(): Promise<void> {
  const payload: HeartbeatPayload = {
    pid: process.pid,
    startedAt: new Date(startedAt).toISOString(),
    lastBeatAt: new Date().toISOString(),
    uptimeMs: Date.now() - startedAt,
  };
  await setSetting("worker_heartbeat", payload);
  logger.debug("heartbeat", payload as unknown as Record<string, unknown>);
}
