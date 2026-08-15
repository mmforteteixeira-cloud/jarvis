import { getAIProvider } from "@jarvis/ai";
import { createLogger } from "@jarvis/shared";

const logger = createLogger("core:reminder-intent");

export interface ReminderIntent {
  message: string;
  dueAt: string;
}

const REMINDER_TRIGGER = /\b(lembra[- ]?me|lembrar[- ]?me|remind me)\b/i;

/**
 * "JARVIS, lembra-me amanhã às 10 de ligar ao médico" -> a persisted
 * reminder the worker fires as a notification when due. Tries an
 * AI-assisted extraction first (handles arbitrary phrasing) when a real
 * provider is configured, falling back to a heuristic PT/EN date/time
 * parser that covers the common cases without needing an API key.
 */
export async function parseReminderIntent(message: string, now: Date = new Date()): Promise<ReminderIntent | null> {
  if (!REMINDER_TRIGGER.test(message)) return null;

  const ai = getAIProvider();
  if (ai.mode === "REAL") {
    try {
      const aiResult = await parseWithAI(message, now);
      if (aiResult) return aiResult;
    } catch (error) {
      logger.warn("AI reminder parsing failed, falling back to heuristic", { error: (error as Error).message });
    }
  }

  return parseHeuristically(message, now);
}

async function parseWithAI(message: string, now: Date): Promise<ReminderIntent | null> {
  const ai = getAIProvider();
  const result = await ai.complete({
    system:
      `You extract a reminder from a user's message. The current date/time is ${now.toISOString()} (ISO-8601, UTC). ` +
      'Respond with ONLY a JSON object {"message": string, "dueAt": string} where dueAt is an ISO-8601 timestamp, ' +
      'or the literal four characters null if the message is not asking to be reminded of something at a specific ' +
      "or relative time. No prose, no markdown fences.",
    messages: [{ role: "user", content: message }],
    maxTokens: 200,
  });

  const text = result.text.trim();
  if (text === "null" || text.length === 0) return null;

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const parsed = JSON.parse(match[0]) as { message?: unknown; dueAt?: unknown };
  if (typeof parsed.message !== "string" || typeof parsed.dueAt !== "string") return null;

  const dueAt = new Date(parsed.dueAt);
  if (Number.isNaN(dueAt.getTime())) return null;

  return { message: parsed.message, dueAt: dueAt.toISOString() };
}

const TIME_PATTERN = /\b(\d{1,2})[:h](\d{2})?\b/i;
const RELATIVE_PATTERN = /\bdaqui\s+a\s+(\d+)\s*(minutos?|horas?)\b|\bin\s+(\d+)\s*(minutes?|hours?)\b/i;
// No trailing \b: JS regex treats "ã" as a non-word character, so a
// boundary assertion right after "amanhã" would never match (same issue
// as CALC_TRIGGER in utility-intent.ts).
const TOMORROW_PATTERN = /\b(amanh[ãa]|tomorrow)/i;
const TODAY_PATTERN = /\b(hoje|today)\b/i;

function parseHeuristically(message: string, now: Date): ReminderIntent | null {
  const relativeMatch = RELATIVE_PATTERN.exec(message);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1] ?? relativeMatch[3]);
    const unit = (relativeMatch[2] ?? relativeMatch[4] ?? "").toLowerCase();
    const ms = unit.startsWith("hora") || unit.startsWith("hour") ? amount * 3_600_000 : amount * 60_000;
    const dueAt = new Date(now.getTime() + ms);
    return { message: extractReminderText(message), dueAt: dueAt.toISOString() };
  }

  const timeMatch = TIME_PATTERN.exec(message);
  const isTomorrow = TOMORROW_PATTERN.test(message);
  const isToday = TODAY_PATTERN.test(message);

  if (timeMatch || isTomorrow || isToday) {
    const hours = timeMatch ? Number(timeMatch[1]) : 9;
    const minutes = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
    if (hours > 23 || minutes > 59) return null;

    const due = new Date(now);
    due.setSeconds(0, 0);
    due.setHours(hours, minutes, 0, 0);
    if (isTomorrow || due.getTime() <= now.getTime()) {
      due.setDate(due.getDate() + 1);
    }
    return { message: extractReminderText(message), dueAt: due.toISOString() };
  }

  return null;
}

function extractReminderText(message: string): string {
  const text = message
    .replace(REMINDER_TRIGGER, "")
    .replace(RELATIVE_PATTERN, "")
    .replace(TIME_PATTERN, "")
    .replace(TOMORROW_PATTERN, "")
    .replace(TODAY_PATTERN, "")
    .replace(/^[\s,]*(de|que|to|para|d['e])\b/i, "")
    .replace(/\b(às|as|at)\b/gi, "")
    .replace(/[.!?]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text || "Reminder";
}
