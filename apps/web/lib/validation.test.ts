import { describe, expect, it } from "vitest";
import { ChatRequestSchema, CreateProjectSchema, CreateTaskSchema, UpdateProjectSchema } from "./validation";

describe("API validation: chat", () => {
  it("accepts a valid message", () => {
    expect(ChatRequestSchema.safeParse({ message: "Hello" }).success).toBe(true);
  });

  it("rejects an empty message", () => {
    expect(ChatRequestSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("rejects a missing message field", () => {
    expect(ChatRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("API validation: projects", () => {
  it("requires a name", () => {
    expect(CreateProjectSchema.safeParse({ description: "no name" }).success).toBe(false);
  });

  it("accepts a minimal valid project", () => {
    expect(CreateProjectSchema.safeParse({ name: "My project" }).success).toBe(true);
  });

  it("rejects an invalid priority value", () => {
    expect(CreateProjectSchema.safeParse({ name: "X", priority: "SUPER_URGENT" }).success).toBe(false);
  });

  it("rejects an invalid status on update", () => {
    expect(UpdateProjectSchema.safeParse({ status: "NOT_A_REAL_STATE" }).success).toBe(false);
  });

  it("accepts a valid status on update", () => {
    expect(UpdateProjectSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(true);
  });
});

describe("API validation: tasks", () => {
  it("requires a non-empty description", () => {
    expect(CreateTaskSchema.safeParse({ description: "" }).success).toBe(false);
  });

  it("accepts a task with a valid agentType", () => {
    expect(CreateTaskSchema.safeParse({ description: "do X", agentType: "FILE" }).success).toBe(true);
  });

  it("rejects an invalid agentType", () => {
    expect(CreateTaskSchema.safeParse({ description: "do X", agentType: "NOT_AN_AGENT" }).success).toBe(false);
  });

  it("allows a null agentType (plan-level step)", () => {
    expect(CreateTaskSchema.safeParse({ description: "plan step", agentType: null }).success).toBe(true);
  });
});
