import { describe, expect, it, beforeEach } from "vitest";
import { getOrCreateDefaultUser, listConversations } from "@jarvis/db";
import { JarvisCore } from "./jarvis-core.js";
import { Orchestrator } from "./orchestrator.js";
import { TaskEngine } from "./task-engine.js";

describe("JarvisCore", () => {
  let userId: string;
  let jarvisCore: JarvisCore;

  beforeEach(async () => {
    const user = await getOrCreateDefaultUser(`test-${Date.now()}-${Math.random()}@local`, "Test User");
    userId = user.id;
    const taskEngine = new TaskEngine({ workspaceRoot: "/tmp/jarvis-test-workspace", userId });
    const orchestrator = new Orchestrator(taskEngine);
    jarvisCore = new JarvisCore(orchestrator, taskEngine);
  });

  it("titles a new conversation from the first message", async () => {
    await jarvisCore.chat({ userId, message: "What's the weather like in Lisbon?" });
    const conversations = await listConversations(userId);
    expect(conversations[0].title).toBe("What's the weather like in Lisbon?");
  });

  it("truncates very long first messages when deriving a title", async () => {
    const long = "a".repeat(120);
    await jarvisCore.chat({ userId, message: long });
    const conversations = await listConversations(userId);
    expect(conversations[0].title.length).toBeLessThanOrEqual(60);
    expect(conversations[0].title.endsWith("...")).toBe(true);
  });

  it("prepareChatStream returns a streamable preparation for plain chat (heuristic mode)", async () => {
    const prep = await jarvisCore.prepareChatStream({ userId, message: "hello there" });
    expect("finalize" in prep).toBe(true);
    if ("finalize" in prep) {
      expect(prep.system.length).toBeGreaterThan(0);
      const response = await prep.finalize("a heuristic reply", "DEMO");
      expect(response.aiMode).toBe("DEMO");
      expect(response.message.content).toBe("a heuristic reply");
      expect(response.conversationId).toBe(prep.conversationId);
    }
  });

  it("prepareChatStream resolves computer tool intents immediately (non-streamable)", async () => {
    const prep = await jarvisCore.prepareChatStream({ userId, message: "screenshot" });
    expect("finalize" in prep).toBe(false);
    if (!("finalize" in prep)) {
      expect(prep.executedTask?.agentType).toBe("COMPUTER");
    }
  });

  it("chat() persists both the user message and the assistant reply", async () => {
    const response = await jarvisCore.chat({ userId, message: "hi jarvis" });
    expect(response.message.role).toBe("assistant");
    expect(response.conversationId).toBeTruthy();
  });

  it("answers a calculator question instantly, without touching the AI provider", async () => {
    const response = await jarvisCore.chat({ userId, message: "quanto é 6*7" });
    expect(response.message.content).toContain("= 42");
  });

  it("reports weather questions as honestly not configured when there's no WEATHER_API_KEY", async () => {
    const response = await jarvisCore.chat({ userId, message: "what's the weather like in Lisbon?" });
    expect(response.message.content.toLowerCase()).toContain("not configured");
  });

  it("creates a real reminder for a reminder request", async () => {
    const response = await jarvisCore.chat({ userId, message: "lembra-me daqui a 10 minutos de ligar ao dentista" });
    expect(response.message.content).toContain("Reminder set");
    expect(response.message.content).toContain("ligar ao dentista");
  });
});
