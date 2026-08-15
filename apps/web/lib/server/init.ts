import "server-only";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getOrCreateDefaultUser, type UserRecord } from "@jarvis/db";
import { getAgentRegistry, type AgentRegistry } from "@jarvis/agents";
import { Orchestrator, TaskEngine, JarvisCore, ProjectSystem } from "@jarvis/core";

const WORKSPACE_ROOT = resolve(process.cwd(), "..", "..", "workspace");

let bootstrapped: {
  user: UserRecord;
  registry: AgentRegistry;
  taskEngine: TaskEngine;
  orchestrator: Orchestrator;
  jarvisCore: JarvisCore;
  projects: ProjectSystem;
} | null = null;

/**
 * Lazily initializes JARVIS's server-side singletons once per process:
 * ensures the workspace sandbox directory exists, the default local user
 * exists, the agent registry is ready, and the core services are wired
 * together. Route handlers call this instead of constructing services
 * themselves.
 */
export async function getJarvis() {
  if (bootstrapped) return bootstrapped;

  mkdirSync(WORKSPACE_ROOT, { recursive: true });

  const user = await getOrCreateDefaultUser(process.env.JARVIS_OWNER_EMAIL ?? "owner@local", "Owner");
  const registry = getAgentRegistry(WORKSPACE_ROOT);
  await registry.syncDescriptors();

  const taskEngine = new TaskEngine({ workspaceRoot: WORKSPACE_ROOT, userId: user.id });
  const orchestrator = new Orchestrator(taskEngine);
  const jarvisCore = new JarvisCore(orchestrator);
  const projects = new ProjectSystem();

  bootstrapped = { user, registry, taskEngine, orchestrator, jarvisCore, projects };
  return bootstrapped;
}

export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}
