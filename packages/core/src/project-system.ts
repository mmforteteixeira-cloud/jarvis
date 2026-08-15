import {
  createProject as dbCreateProject,
  getProject,
  listProjects,
  updateProject as dbUpdateProject,
  updateProjectStatus,
  logActivity,
  type CreateProjectInput,
} from "@jarvis/db";
import { ValidationError, type Project, type ProjectState } from "@jarvis/shared";

const VALID_PROJECT_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  PLANNING: ["IN_PROGRESS", "ARCHIVED", "FAILED"],
  IN_PROGRESS: ["TESTING", "WAITING", "FAILED", "ARCHIVED"],
  TESTING: ["IN_PROGRESS", "COMPLETED", "FAILED"],
  WAITING: ["IN_PROGRESS", "FAILED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  FAILED: ["PLANNING", "ARCHIVED"],
  ARCHIVED: [],
};

export class ProjectSystem {
  async create(input: CreateProjectInput): Promise<Project> {
    const project = await dbCreateProject(input);
    await logActivity({
      agentType: "SYSTEM",
      toolName: null,
      action: "project.created",
      result: "SUCCESS",
      durationMs: null,
      taskId: null,
      projectId: project.id,
      details: { name: project.name },
    });
    return project;
  }

  async list(userId?: string): Promise<Project[]> {
    return listProjects(userId);
  }

  async get(id: string): Promise<Project | undefined> {
    return getProject(id);
  }

  async update(id: string, patch: Partial<Pick<Project, "name" | "description" | "goal" | "priority">>): Promise<Project> {
    return dbUpdateProject(id, patch);
  }

  async transition(id: string, status: ProjectState): Promise<Project> {
    const project = await getProject(id);
    if (!project) throw new ValidationError(`Project ${id} not found`);
    if (project.status !== status) {
      const allowed = VALID_PROJECT_TRANSITIONS[project.status];
      if (!allowed.includes(status)) {
        throw new ValidationError(`Invalid project state transition: ${project.status} -> ${status}`);
      }
    }
    return updateProjectStatus(id, status);
  }
}
