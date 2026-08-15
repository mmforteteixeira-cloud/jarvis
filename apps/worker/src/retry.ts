import { createLogger } from "@jarvis/shared";
import { createNotification } from "@jarvis/db";
import type { TaskEngine } from "@jarvis/core";

const logger = createLogger("worker:retry");

function backoffElapsedMs(retryCount: number): number {
  return Math.min(2 ** retryCount * 5_000, 5 * 60_000); // cap at 5 minutes
}

// Prevents re-notifying about the same permanently-failed task on every
// tick — process-lifetime memory is enough here since a restart is a
// reasonable point to re-surface a still-unresolved failure.
const notifiedExhausted = new Set<string>();

/**
 * Auto-retries FAILED tasks that still have retry budget, with exponential
 * backoff. Tasks failed because the user explicitly denied a permission
 * request are never auto-retried — that's a decision, not a transient
 * error. Tasks that exhaust their retry budget get a notification instead
 * of retrying forever.
 */
export async function runRetryTick(taskEngine: TaskEngine, userId: string): Promise<void> {
  const failed = await taskEngine.list({ state: "FAILED" });

  for (const task of failed) {
    if (task.error?.startsWith("Permission denied")) continue;

    const elapsedSinceFailure = Date.now() - new Date(task.updatedAt).getTime();
    if (task.retryCount >= task.maxRetries) continue;
    if (elapsedSinceFailure < backoffElapsedMs(task.retryCount)) continue;

    try {
      logger.info("Auto-retrying failed task", { taskId: task.id, retryCount: task.retryCount });
      await taskEngine.retry(task.id);
    } catch (error) {
      logger.error("Auto-retry failed to schedule", { taskId: task.id, error: (error as Error).message });
    }
  }

  const exhausted = failed.filter(
    (t) => t.retryCount >= t.maxRetries && !t.error?.startsWith("Permission denied") && !notifiedExhausted.has(t.id),
  );
  for (const task of exhausted) {
    notifiedExhausted.add(task.id);
    await createNotification({
      userId,
      title: "Task failed permanently",
      message: `"${task.description}" failed after ${task.retryCount} retries: ${task.error ?? "unknown error"}`,
      severity: "error",
      taskId: task.id,
      projectId: task.projectId,
    });
  }
}
