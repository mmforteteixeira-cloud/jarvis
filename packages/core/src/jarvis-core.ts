import {
  addMessage,
  createConversation,
  getConversation,
  listMessages,
} from "@jarvis/db";
import { getAIProvider } from "@jarvis/ai";
import { saveMemory, buildMemoryContext, pruneShortTermMemory } from "@jarvis/memory";
import { createLogger, type Conversation, type Message } from "@jarvis/shared";
import { JARVIS_SYSTEM_PROMPT } from "./persona.js";
import { Orchestrator, type OrchestratePlanResult } from "./orchestrator.js";

const logger = createLogger("core:jarvis");

const GOAL_INTENT = /\b(cria|criar|constr[oó]i|desenvolve|desenvolver|faz(?:e)?[- ]?me|build|create|make)\b.{0,40}\b(aplica[cç][aã]o|app|projeto|website|site|sistema|programa|plataforma|project)\b/i;

export interface ChatRequest {
  userId: string;
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: Message;
  aiMode: "REAL" | "DEMO";
  createdPlan?: OrchestratePlanResult;
}

/**
 * JARVIS Core: the front door. Owns conversation state, pulls in memory
 * context, decides whether a message is a goal that needs a project + plan
 * (routes to the Orchestrator) or a normal exchange (routes to the AI
 * provider), and writes the result back to memory.
 */
export class JarvisCore {
  constructor(private readonly orchestrator: Orchestrator) {}

  private async resolveConversation(userId: string, conversationId?: string): Promise<Conversation> {
    if (conversationId) {
      const existing = await getConversation(conversationId);
      if (existing) return existing;
    }
    return createConversation(userId, "New conversation");
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const conversation = await this.resolveConversation(req.userId, req.conversationId);
    await addMessage(conversation.id, "user", req.message);

    if (GOAL_INTENT.test(req.message)) {
      const plan = await this.orchestrator.planGoal({ userId: req.userId, goal: req.message });
      const summary = formatPlanSummary(plan);
      const assistantMessage = await addMessage(conversation.id, "assistant", summary);

      await saveMemory({
        userId: req.userId,
        type: "PROJECT",
        projectId: plan.project.id,
        content: `Created project "${plan.project.name}" from goal: ${req.message}`,
        importance: 0.7,
      });

      return {
        conversationId: conversation.id,
        message: assistantMessage,
        aiMode: plan.plan.source === "ai" ? "REAL" : "DEMO",
        createdPlan: plan,
      };
    }

    const ai = getAIProvider();
    const history = await listMessages(conversation.id);
    const memories = await buildMemoryContext(req.userId);

    const memoryBlock =
      memories.length > 0
        ? `\n\nRelevant memory:\n${memories.map((m) => `- (${m.type}) ${m.content}`).join("\n")}`
        : "";

    const result = await ai.complete({
      system: JARVIS_SYSTEM_PROMPT + memoryBlock,
      messages: history.slice(-20).map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content })),
    });

    const assistantMessage = await addMessage(conversation.id, "assistant", result.text);

    await saveMemory({
      userId: req.userId,
      type: "SHORT_TERM",
      content: `User said: "${req.message}" — JARVIS replied: "${truncate(result.text, 200)}"`,
      importance: 0.3,
    });
    await pruneShortTermMemory(req.userId);

    return { conversationId: conversation.id, message: assistantMessage, aiMode: result.mode };
  }
}

function formatPlanSummary(plan: OrchestratePlanResult): string {
  const lines = plan.tasks.map((t, i) => `${i + 1}. ${t.description}${t.agentType ? ` [${t.agentType}]` : ""}`);
  return (
    `I've created a project: "${plan.project.name}".\n\n` +
    `Plan (${plan.plan.source === "ai" ? "AI-generated" : "heuristic template — no AI provider configured"}):\n` +
    lines.join("\n") +
    `\n\nNothing has been executed yet — these are queued tasks. Tell me to run one, or open the Tasks panel.`
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
