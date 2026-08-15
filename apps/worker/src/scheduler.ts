import { createLogger } from "@jarvis/shared";
import type { TaskEngine } from "@jarvis/core";

const logger = createLogger("worker:scheduler");
const MAX_TASKS_PER_TICK = 3;

/**
 * Picks up PENDING tasks that have an agent assigned (i.e. are actually
 * executable, not plan-level steps) and runs them one at a time. Errors in
 * one task are caught and logged so a single bad task never kills the
 * worker loop — this is the "error recovery" half of the 24/7 architecture.
 */
export async function runSchedulerTick(taskEngine: TaskEngine): Promise<void> {
  const pending = await taskEngine.list({ state: "PENDING" });
  const executable = pending.filter((t) => t.agentType).slice(0, MAX_TASKS_PER_TICK);

  for (const task of executable) {
    try {
      logger.info("Executing task", { taskId: task.id, agentType: task.agentType });
      const result = await taskEngine.execute(task.id);
      logger.info("Task finished", { taskId: task.id, state: result.state });
    } catch (error) {
      logger.error("Task execution threw unexpectedly", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
