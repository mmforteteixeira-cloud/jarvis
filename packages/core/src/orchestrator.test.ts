import { describe, expect, it, beforeEach } from "vitest";
import { getOrCreateDefaultUser } from "@jarvis/db";
import { Orchestrator } from "./orchestrator.js";
import { TaskEngine } from "./task-engine.js";
import { createPlan } from "./planner.js";

describe("planner", () => {
  it("produces a software-project plan for an app-building goal (heuristic mode)", async () => {
    const plan = await createPlan("Cria uma aplicação de currículos");
    expect(plan.source).toBe("heuristic");
    expect(plan.steps.length).toBeGreaterThan(3);
    expect(plan.steps.some((s) => s.agentType === "DEVELOPER")).toBe(true);
  });

  it("produces a research-oriented plan for a generic goal", async () => {
    const plan = await createPlan("Find the best coffee shops in Lisbon");
    expect(plan.steps[0].agentType).toBe("RESEARCH");
  });
});

describe("orchestrator", () => {
  let userId: string;
  let taskEngine: TaskEngine;
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    const user = await getOrCreateDefaultUser(`test-${Date.now()}-${Math.random()}@local`, "Test User");
    userId = user.id;
    taskEngine = new TaskEngine({ workspaceRoot: "/tmp/jarvis-test-workspace", userId });
    orchestrator = new Orchestrator(taskEngine);
  });

  it("turns a goal into a project with a persisted task breakdown", async () => {
    const result = await orchestrator.planGoal({ userId, goal: "Cria uma aplicação de currículos" });

    expect(result.project.status).toBe("PLANNING");
    expect(result.tasks.length).toBe(result.plan.steps.length);
    expect(result.tasks.every((t) => t.state === "PENDING")).toBe(true);
  });

  it("chains tasks with dependsOn in plan order", async () => {
    const result = await orchestrator.planGoal({ userId, goal: "Research something" });
    for (let i = 1; i < result.tasks.length; i++) {
      expect(result.tasks[i].dependsOn).toEqual([result.tasks[i - 1].id]);
    }
    expect(result.tasks[0].dependsOn).toEqual([]);
  });
});
