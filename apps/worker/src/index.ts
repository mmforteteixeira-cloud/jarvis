import { createLogger } from "@jarvis/shared";
import { bootstrap } from "./bootstrap.js";
import { runSchedulerTick } from "./scheduler.js";
import { runRetryTick } from "./retry.js";
import { runReminderTick } from "./reminders.js";
import { beat } from "./heartbeat.js";

const logger = createLogger("worker");

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 15000);

/**
 * JARVIS's 24/7 background worker: polls the persistent task queue, retries
 * failed tasks with backoff, and beats a heartbeat so liveness is
 * observable. Every tick is wrapped so one failure never stops the loop —
 * that's the whole point of running this as a separate long-lived process
 * from the web app.
 */
async function main() {
  const { taskEngine, user } = await bootstrap();
  logger.info("JARVIS background worker started", { pollIntervalMs: POLL_INTERVAL_MS, heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS });

  let stopped = false;

  const pollTimer = setInterval(async () => {
    if (stopped) return;
    try {
      await runSchedulerTick(taskEngine);
      await runRetryTick(taskEngine, user.id);
      await runReminderTick();
    } catch (error) {
      logger.error("Scheduler tick failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }, POLL_INTERVAL_MS);

  const heartbeatTimer = setInterval(async () => {
    if (stopped) return;
    try {
      await beat();
    } catch (error) {
      logger.error("Heartbeat failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }, HEARTBEAT_INTERVAL_MS);

  await beat();

  function shutdown(signal: string) {
    if (stopped) return;
    stopped = true;
    logger.info("Shutting down worker", { signal });
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error("Worker crashed on startup", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
