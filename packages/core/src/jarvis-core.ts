import {
  addMessage,
  createConversation,
  createReminder,
  getConversation,
  listMessages,
} from "@jarvis/db";
import { getAIProvider, type AIMessage } from "@jarvis/ai";
import { saveMemory, buildMemoryContext, pruneShortTermMemory } from "@jarvis/memory";
import { createLogger, type Conversation, type Message, type Task } from "@jarvis/shared";
import { JARVIS_SYSTEM_PROMPT } from "./persona.js";
import { Orchestrator, type OrchestratePlanResult } from "./orchestrator.js";
import { TaskEngine } from "./task-engine.js";
import { parseToolIntent, type ToolIntent } from "./tool-intent.js";
import { parseUtilityIntent } from "./utility-intent.js";
import { parseReminderIntent } from "./reminder-intent.js";

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
  executedTask?: Task;
}

/**
 * JARVIS Core: the front door. Owns conversation state, pulls in memory
 * context, decides whether a message is a goal that needs a project + plan
 * (routes to the Orchestrator), a direct tool command (routes to an agent
 * via the Task Engine — same approval flow as everything else), or a
 * normal exchange (routes to the AI provider), and writes the result back
 * to memory.
 */
export class JarvisCore {
  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly taskEngine: TaskEngine,
  ) {}

  private async resolveConversation(userId: string, conversationId?: string, firstMessage?: string): Promise<Conversation> {
    if (conversationId) {
      const existing = await getConversation(conversationId);
      if (existing) return existing;
    }
    return createConversation(userId, deriveConversationTitle(firstMessage));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const prep = await this.prepareChatStream(req);
    if (isChatResponse(prep)) return prep;

    const ai = getAIProvider();
    const result = await ai.complete({ system: prep.system, messages: prep.messages });
    return prep.finalize(result.text, result.mode);
  }

  /**
   * Same routing as chat() (tool intents and goal/project intents still
   * resolve immediately, since neither is meaningfully "streamable" — a
   * tool call either ran or it didn't), but for the plain-conversation
   * branch it stops short of calling the AI provider and instead returns
   * everything a caller needs to stream the completion itself and persist
   * the result afterward via finalize(). Used by the SSE chat endpoint;
   * chat() above is just this method run to completion non-streamed.
   */
  async prepareChatStream(req: ChatRequest): Promise<ChatResponse | StreamPreparation> {
    const conversation = await this.resolveConversation(req.userId, req.conversationId, req.message);
    await addMessage(conversation.id, "user", req.message);

    const toolIntent = await parseToolIntent(req.message);
    if (toolIntent) {
      const created = await this.taskEngine.create({
        description: toolIntent.description,
        agentType: toolIntent.agentType,
        input: { type: toolIntent.tool, payload: toolIntent.input },
        priority: "MEDIUM",
      });
      const executed = await this.taskEngine.execute(created.id);
      const summary = formatToolExecutionSummary(toolIntent, executed);
      const assistantMessage = await addMessage(conversation.id, "assistant", summary);
      return { conversationId: conversation.id, message: assistantMessage, aiMode: "REAL", executedTask: executed };
    }

    const reminderIntent = await parseReminderIntent(req.message);
    if (reminderIntent) {
      const reminder = await createReminder({
        userId: req.userId,
        message: reminderIntent.message,
        dueAt: reminderIntent.dueAt,
      });
      const reply = `Reminder set: "${reminder.message}" for ${formatDueAt(reminder.dueAt)}.`;
      const assistantMessage = await addMessage(conversation.id, "assistant", reply);
      return { conversationId: conversation.id, message: assistantMessage, aiMode: "REAL" };
    }

    const utilityIntent = parseUtilityIntent(req.message);
    if (utilityIntent) {
      const assistantMessage = await addMessage(conversation.id, "assistant", utilityIntent.reply);
      return { conversationId: conversation.id, message: assistantMessage, aiMode: "REAL" };
    }

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

    const history = await listMessages(conversation.id);
    const memories = await buildMemoryContext(req.userId);

    const memoryBlock =
      memories.length > 0
        ? `\n\nRelevant memory:\n${memories.map((m) => `- (${m.type}) ${m.content}`).join("\n")}`
        : "";

    return {
      conversationId: conversation.id,
      system: JARVIS_SYSTEM_PROMPT + memoryBlock,
      messages: history.slice(-20).map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content })),
      finalize: async (text: string, mode: "REAL" | "DEMO") => {
        const assistantMessage = await addMessage(conversation.id, "assistant", text);

        await saveMemory({
          userId: req.userId,
          type: "SHORT_TERM",
          content: `User said: "${req.message}" — JARVIS replied: "${truncate(text, 200)}"`,
          importance: 0.3,
        });
        await pruneShortTermMemory(req.userId);

        return { conversationId: conversation.id, message: assistantMessage, aiMode: mode };
      },
    };
  }
}

export interface StreamPreparation {
  conversationId: string;
  system: string;
  messages: AIMessage[];
  finalize: (fullText: string, mode: "REAL" | "DEMO") => Promise<ChatResponse>;
}

function isChatResponse(value: ChatResponse | StreamPreparation): value is ChatResponse {
  return "message" in value;
}

function deriveConversationTitle(firstMessage?: string): string {
  const trimmed = firstMessage?.trim();
  if (!trimmed) return "New conversation";
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
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

function formatDueAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatToolExecutionSummary(intent: ToolIntent, task: Task): string {
  switch (task.state) {
    case "COMPLETED":
      return `Done — ${intent.description}.`;
    case "WAITING_APPROVAL":
      return `${intent.description} needs your approval first — check the notification or the Computer page to approve/deny.`;
    case "FAILED":
      return `Couldn't do that: ${task.error ?? "unknown error"}`;
    default:
      return `${intent.description} — currently ${task.state}.`;
  }
}
