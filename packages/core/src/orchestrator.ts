import { logActivity } from "@jarvis/db";
import { createLogger, type Project, type Task, type TaskPriority } from "@jarvis/shared";
import { createPlan, type Plan } from "./planner.js";
import { ProjectSystem } from "./project-system.js";
import { TaskEngine } from "./task-engine.js";

const logger = createLogger("core:orchestrator");

export interface OrchestratePlanResult {
  project: Project;
  tasks: Task[];
  plan: Plan;
}

/**
 * Turns a natural-language goal into a real project with a real, persisted
 * task breakdown. This is the "USER -> ORCHESTRATOR -> PLANNER -> TASK
 * ENGINE" leg of the JARVIS Core flow. It deliberately stops at creating
 * tasks — it never executes MEDIUM/HIGH risk actions itself; that only
 * happens when a task with a concrete agentType is explicitly run (via the
 * worker or a manual "run" action) and passes through the security layer.
 */
export class Orchestrator {
  private readonly projects = new ProjectSystem();

  constructor(private readonly taskEngine: TaskEngine) {}

  async planGoal(params: {
    userId: string;
    goal: string;
    projectName?: string;
    priority?: TaskPriority;
  }): Promise<OrchestratePlanResult> {
    const project = await this.projects.create({
      userId: params.userId,
      name: params.projectName ?? summarizeAsName(params.goal),
      description: params.goal,
      goal: params.goal,
      priority: params.priority,
    });

    const plan = await createPlan(params.goal);

    const tasks: Task[] = [];
    let previousTaskId: string | null = null;
    for (const step of plan.steps) {
      const task = await this.taskEngine.create({
        projectId: project.id,
        description: step.description,
        agentType: step.agentType,
        dependsOn: previousTaskId ? [previousTaskId] : [],
        priority: params.priority ?? "MEDIUM",
      });
      tasks.push(task);
      previousTaskId = task.id;
    }

    await logActivity({
      agentType: "ORCHESTRATOR",
      toolName: null,
      action: "plan.created",
      result: "SUCCESS",
      durationMs: null,
      taskId: null,
      projectId: project.id,
      details: { goal: params.goal, stepCount: tasks.length, planSource: plan.source },
    });

    logger.info("Plan created", { projectId: project.id, steps: tasks.length, source: plan.source });
    return { project, tasks, plan };
  }
}

function summarizeAsName(goal: string): string {
  const trimmed = goal.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}
