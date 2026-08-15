import { describe, expect, it } from "vitest";
import { createTask, getTask, updateTask, cancelTask, retryTask, assertValidTransition } from "./tasks.js";
import { ValidationError } from "@jarvis/shared";

describe("task creation", () => {
  it("creates a task in PENDING state with defaults", async () => {
    const task = await createTask({ description: "Do the thing" });
    expect(task.state).toBe("PENDING");
    expect(task.progress).toBe(0);
    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(3);
    expect(task.dependsOn).toEqual([]);
  });
});

describe("task state transitions", () => {
  it("allows PENDING -> RUNNING -> COMPLETED", () => {
    expect(() => assertValidTransition("PENDING", "RUNNING")).not.toThrow();
    expect(() => assertValidTransition("RUNNING", "COMPLETED")).not.toThrow();
  });

  it("rejects COMPLETED -> RUNNING (terminal state)", () => {
    expect(() => assertValidTransition("COMPLETED", "RUNNING")).toThrow(ValidationError);
  });

  it("rejects PENDING -> COMPLETED (skipping execution)", () => {
    expect(() => assertValidTransition("PENDING", "COMPLETED")).toThrow(ValidationError);
  });

  it("allows WAITING_APPROVAL -> PENDING once approved", () => {
    expect(() => assertValidTransition("WAITING_APPROVAL", "PENDING")).not.toThrow();
  });

  it("persists a state transition via updateTask", async () => {
    const task = await createTask({ description: "Transition me" });
    const running = await updateTask(task.id, { state: "RUNNING" });
    expect(running.state).toBe("RUNNING");

    const fetched = await getTask(task.id);
    expect(fetched?.state).toBe("RUNNING");
  });

  it("rejects an invalid transition through updateTask", async () => {
    const task = await createTask({ description: "Invalid transition" });
    await expect(updateTask(task.id, { state: "COMPLETED" })).rejects.toThrow(ValidationError);
  });

  it("cancel moves a task to CANCELLED", async () => {
    const task = await createTask({ description: "Cancel me" });
    const cancelled = await cancelTask(task.id);
    expect(cancelled.state).toBe("CANCELLED");
  });

  it("retry only works on FAILED tasks within retry budget", async () => {
    const task = await createTask({ description: "Retry me" });
    await expect(retryTask(task.id)).rejects.toThrow(ValidationError);

    await updateTask(task.id, { state: "RUNNING" });
    await updateTask(task.id, { state: "FAILED", error: "boom" });
    const retried = await retryTask(task.id);
    expect(retried.state).toBe("PENDING");
    expect(retried.retryCount).toBe(1);
  });
});
