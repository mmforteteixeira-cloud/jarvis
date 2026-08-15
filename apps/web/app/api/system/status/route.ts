import { getAIProvider } from "@jarvis/ai";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listTasks, listAgentDescriptors, listPermissions, getSetting } from "@jarvis/db";

const WORKER_ALIVE_THRESHOLD_MS = 60_000;

interface HeartbeatPayload {
  pid: number;
  startedAt: string;
  lastBeatAt: string;
  uptimeMs: number;
}

export const GET = withErrorHandling(async () => {
  await getJarvis();
  const ai = getAIProvider();
  const [running, waiting, agents, pendingPermissions, heartbeat] = await Promise.all([
    listTasks({ state: "RUNNING" }),
    listTasks({ state: "WAITING_APPROVAL" }),
    listAgentDescriptors(),
    listPermissions({ state: "PENDING" }),
    getSetting<HeartbeatPayload>("worker_heartbeat"),
  ]);

  const status = running.length > 0 ? "BUSY" : "ONLINE";
  const workerAlive = heartbeat ? Date.now() - new Date(heartbeat.lastBeatAt).getTime() < WORKER_ALIVE_THRESHOLD_MS : false;

  return ok({
    status,
    aiProvider: { name: ai.name, mode: ai.mode, model: ai.model },
    worker: { running: workerAlive, lastBeatAt: heartbeat?.lastBeatAt ?? null },
    counts: {
      runningTasks: running.length,
      waitingApproval: waiting.length,
      pendingPermissions: pendingPermissions.length,
      agentsWorking: agents.filter((a) => a.status === "WORKING").length,
      agentsIdle: agents.filter((a) => a.status === "IDLE").length,
    },
  });
});
