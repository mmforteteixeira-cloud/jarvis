import {
  appendTaskLog,
  cancelTask as dbCancelTask,
  createTask as dbCreateTask,
  getTask,
  listTasks,
  logActivity,
  retryTask as dbRetryTask,
  startAgentRun,
  finishAgentRun,
  updateTask,
  createNotification,
  type CreateTaskInput,
} from "@jarvis/db";
import { getAgentRegistry } from "@jarvis/agents";
import { createLogger, ValidationError, type Task } from "@jarvis/shared";

const logger = createLogger("core:task-engine");

export interface TaskEngineOptions {
  workspaceRoot: string;
  userId: string;
}

/**
 * The persistent task queue's execution engine. Task *storage* and state
 * transitions live in @jarvis/db (so the API layer can manage tasks without
 * pulling in agents); this module is what actually runs a task by
 * dispatching it to the right agent, and is what the background worker
 * calls on each poll.
 */
export class TaskEngine {
  constructor(private readonly options: TaskEngineOptions) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const task = await dbCreateTask(input);
    await logActivity({
      agentType: "SYSTEM",
      toolName: null,
      action: "task.created",
      result: "SUCCESS",
      durationMs: null,
      taskId: task.id,
      projectId: task.projectId,
      details: { description: task.description },
    });
    return task;
  }

  async list(filter?: { projectId?: string; state?: Task["state"] }): Promise<Task[]> {
    return listTasks(filter);
  }

  async get(id: string): Promise<Task | undefined> {
    return getTask(id);
  }

  async pause(id: string): Promise<Task> {
    return updateTask(id, { state: "PENDING" });
  }

  async cancel(id: string): Promise<Task> {
    const task = await dbCancelTask(id);
    await logActivity({
      agentType: "SYSTEM",
      toolName: null,
      action: "task.cancelled",
      result: "SUCCESS",
      durationMs: null,
      taskId: id,
      projectId: task.projectId,
      details: {},
    });
    return task;
  }

  async retry(id: string): Promise<Task> {
    return dbRetryTask(id);
  }

  /**
   * Runs one executable task to completion (or to WAITING_APPROVAL/FAILED).
   * Only tasks with an assigned agentType + structured input are
   * auto-executable — plan-level tasks (agentType: null) describe a step
   * for a human or a future planner pass, and are left PENDING.
   */
  async execute(id: string): Promise<Task> {
    const task = await getTask(id);
    if (!task) throw new ValidationError(`Task ${id} not found`);
    if (task.state !== "PENDING") {
      throw new ValidationError(`Task ${id} is not PENDING (current: ${task.state})`);
    }
    if (!task.agentType) {
      throw new ValidationError(
        `Task ${id} has no agent assigned — it is a plan-level step, not an executable action.`,
      );
    }

    const registry = getAgentRegistry(this.options.workspaceRoot);
    const agent = registry.get(task.agentType);

    await updateTask(id, { state: "RUNNING" });
    await appendTaskLog(id, { level: "info", message: `Dispatching to ${task.agentType} agent` });
    const run = await startAgentRun(id, task.agentType, task.input);
    const start = Date.now();

    try {
      const result = await agent.execute({ taskId: id, projectId: task.projectId, input: task.input });
      const durationMs = Date.now() - start;

      if (result.requiresApproval) {
        await updateTask(id, { state: "WAITING_APPROVAL" });
        await appendTaskLog(id, { level: "warn", message: `Waiting for approval: ${result.requiresApproval.action}` });
        await finishAgentRun(run.id, { status: "FAILED", error: "WAITING_APPROVAL" });
        await createNotification({
          userId: this.options.userId,
          title: "JARVIS needs your approval",
          message: `${task.agentType} wants to: ${result.requiresApproval.action} — ${result.requiresApproval.reason}`,
          severity: "warning",
          taskId: id,
          projectId: task.projectId,
        });
        await logActivity({
          agentType: task.agentType,
          toolName: null,
          action: result.requiresApproval.action,
          result: "PENDING",
          durationMs,
          taskId: id,
          projectId: task.projectId,
          details: { permissionRequestId: result.requiresApproval.id },
        });
        return (await getTask(id))!;
      }

      if (!result.success) {
        await finishAgentRun(run.id, { status: "FAILED", error: result.error });
        await appendTaskLog(id, { level: "error", message: result.error ?? "Agent execution failed" });
        await updateTask(id, { state: "FAILED", error: result.error ?? "Unknown error" });
        await logActivity({
          agentType: task.agentType,
          toolName: null,
          action: "agent.execute",
          result: "FAILURE",
          durationMs,
          taskId: id,
          projectId: task.projectId,
          details: { error: result.error, mode: result.mode },
        });
        return (await getTask(id))!;
      }

      await finishAgentRun(run.id, { status: "COMPLETED", output: result.output });
      await appendTaskLog(id, { level: "info", message: "Completed successfully" });
      await updateTask(id, { state: "COMPLETED", progress: 100, result: result.output });
      await logActivity({
        agentType: task.agentType,
        toolName: null,
        action: "agent.execute",
        result: "SUCCESS",
        durationMs,
        taskId: id,
        projectId: task.projectId,
        details: { mode: result.mode },
      });
      return (await getTask(id))!;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishAgentRun(run.id, { status: "FAILED", error: message });
      await appendTaskLog(id, { level: "error", message });
      await updateTask(id, { state: "FAILED", error: message });
      await logActivity({
        agentType: task.agentType,
        toolName: null,
        action: "agent.execute",
        result: "FAILURE",
        durationMs: Date.now() - start,
        taskId: id,
        projectId: task.projectId,
        details: { error: message },
      });
      logger.error("Task execution threw", { taskId: id, error: message });
      return (await getTask(id))!;
    }
  }
}
