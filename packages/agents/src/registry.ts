import { upsertAgentDescriptor, listDevices, reapStaleDevices } from "@jarvis/db";
import type { AgentDescriptor, AgentType } from "@jarvis/shared";
import type { Agent } from "./base.js";
import { FileAgent } from "./file-agent.js";
import { DeveloperAgent } from "./developer-agent.js";
import { ResearchAgent } from "./research-agent.js";
import { BrowserAgent } from "./browser-agent.js";
import { ComputerAgent } from "./computer-agent.js";
import { EmailAgent } from "./email-agent.js";
import { ContentAgent } from "./content-agent.js";

export interface AgentRegistryOptions {
  workspaceRoot: string;
}

export class AgentRegistry {
  private readonly agents: Map<AgentType, Agent>;

  constructor(options: AgentRegistryOptions) {
    this.agents = new Map<AgentType, Agent>([
      ["FILE", new FileAgent(options.workspaceRoot)],
      ["DEVELOPER", new DeveloperAgent(options.workspaceRoot)],
      ["RESEARCH", new ResearchAgent()],
      ["BROWSER", new BrowserAgent()],
      ["COMPUTER", new ComputerAgent()],
      ["EMAIL", new EmailAgent()],
      ["CONTENT", new ContentAgent()],
    ]);
  }

  get(type: AgentType): Agent {
    const agent = this.agents.get(type);
    if (!agent) throw new Error(`No agent registered for type: ${type}`);
    return agent;
  }

  all(): Agent[] {
    return Array.from(this.agents.values());
  }

  /** Persists current descriptors (status/capabilities) to the DB so the UI
   * can render agent state without re-instantiating every agent. When
   * userId is supplied, the Computer Agent's descriptor is overridden with
   * its *real* live device status — "não quero uma interface falsa": the
   * generic Agents grid must flip to connected the moment a daemon is
   * actually online, not show a permanently-static placeholder. */
  async syncDescriptors(userId?: string): Promise<void> {
    const descriptors = this.all().map((agent) => agent.descriptor());

    if (userId) {
      await reapStaleDevices(userId);
      const devices = await listDevices(userId);
      const online = devices.some((d) => d.status === "ONLINE" || d.status === "BUSY");
      const computer = descriptors.find((d) => d.type === "COMPUTER");
      if (computer) {
        computer.status = online ? "IDLE" : "NOT_CONNECTED";
        computer.capabilities = online
          ? ["open applications", "open URLs", "screenshots", "file operations (sandboxed)", "run allow-listed commands"]
          : [];
      }
    }

    await Promise.all(descriptors.map((descriptor: AgentDescriptor) => upsertAgentDescriptor(descriptor)));
  }
}

let registryInstance: AgentRegistry | null = null;

export function getAgentRegistry(workspaceRoot: string): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry({ workspaceRoot });
  }
  return registryInstance;
}
