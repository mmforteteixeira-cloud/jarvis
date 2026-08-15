import { describe, expect, it } from "vitest";
import { createProject, getProject, listProjects, updateProjectStatus } from "./projects.js";

describe("project creation", () => {
  it("creates a project with sensible defaults", async () => {
    const project = await createProject({ userId: "user_1", name: "Test Project" });

    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe("Test Project");
    expect(project.status).toBe("PLANNING");
    expect(project.priority).toBe("MEDIUM");
    expect(project.createdAt).toBe(project.updatedAt);
  });

  it("persists and retrieves the project", async () => {
    const created = await createProject({ userId: "user_1", name: "Retrieve Me" });
    const fetched = await getProject(created.id);
    expect(fetched?.name).toBe("Retrieve Me");
  });

  it("lists only a given user's projects", async () => {
    await createProject({ userId: "user_a", name: "A's project" });
    await createProject({ userId: "user_b", name: "B's project" });

    const aProjects = await listProjects("user_a");
    expect(aProjects.every((p) => p.userId === "user_a")).toBe(true);
    expect(aProjects.some((p) => p.name === "B's project")).toBe(false);
  });

  it("moves a project between valid states", async () => {
    const project = await createProject({ userId: "user_1", name: "State Machine" });
    const updated = await updateProjectStatus(project.id, "IN_PROGRESS");
    expect(updated.status).toBe("IN_PROGRESS");
  });
});
