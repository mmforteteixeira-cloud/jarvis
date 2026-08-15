import { getAIProvider } from "@jarvis/ai";
import { classifyAppOpen } from "@jarvis/security";
import type { AgentType, ComputerCommandType } from "@jarvis/shared";
import { createLogger } from "@jarvis/shared";

const logger = createLogger("core:tool-intent");

export interface ToolIntent {
  agentType: AgentType;
  tool: ComputerCommandType;
  input: Record<string, unknown>;
  description: string;
}

/**
 * Generic natural-language -> {agent, tool, input} mapping. This is
 * deliberately NOT a pile of `if (message.includes("safari"))` special
 * cases — every phrase resolves through the same small set of intent
 * shapes, and the actual "is this app/URL/path allowed" decision is left
 * entirely to the security layer (enforceAction + computer-policy) that
 * runs when the resulting task is executed. This module's only job is
 * "what does the user want", never "should they be allowed to".
 *
 * RUN_COMMAND is intentionally never produced here: turning vague natural
 * language into an actual shell command to execute is a much larger (and
 * riskier) inference than "open this named app" — it needs either an
 * explicit command from the user or real project context JARVIS doesn't
 * have yet. See AGENTS.md for this documented gap.
 */
const SAFE_COMPUTER_TOOLS: ComputerCommandType[] = [
  "OPEN_APPLICATION",
  "OPEN_URL",
  "SCREENSHOT",
  "LIST_DIRECTORY",
  "CREATE_DIRECTORY",
];

export async function parseToolIntent(message: string): Promise<ToolIntent | null> {
  const ai = getAIProvider();
  if (ai.mode === "REAL") {
    try {
      const llmIntent = await parseWithAI(message);
      if (llmIntent) return llmIntent;
    } catch (error) {
      logger.warn("AI tool-intent parsing failed, falling back to heuristic", { error: (error as Error).message });
    }
  }
  return parseHeuristically(message);
}

async function parseWithAI(message: string): Promise<ToolIntent | null> {
  const ai = getAIProvider();
  const result = await ai.complete({
    system:
      "You extract a single tool call from a user's message, if one is clearly present. " +
      'Respond with ONLY a JSON object {"tool": one of ["OPEN_APPLICATION","OPEN_URL","SCREENSHOT","LIST_DIRECTORY","CREATE_DIRECTORY"], "input": {...}} ' +
      'or the literal string "null" (no quotes needed around it, just the four characters) if the message is not asking to control the computer. ' +
      'input shapes: OPEN_APPLICATION -> {"application": string}, OPEN_URL -> {"url": string}, SCREENSHOT -> {}, ' +
      'LIST_DIRECTORY -> {"path": string}, CREATE_DIRECTORY -> {"path": string}. No prose, no markdown fences.',
    messages: [{ role: "user", content: message }],
    maxTokens: 200,
  });

  const text = result.text.trim();
  if (text === "null" || text.length === 0) return null;

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const parsed = JSON.parse(match[0]) as { tool?: unknown; input?: unknown };
  if (typeof parsed.tool !== "string" || !SAFE_COMPUTER_TOOLS.includes(parsed.tool as ComputerCommandType)) return null;

  const tool = parsed.tool as ComputerCommandType;
  const input = (parsed.input ?? {}) as Record<string, unknown>;
  return { agentType: "COMPUTER", tool, input, description: describeIntent(tool, input) };
}

const OPEN_VERB = /\b(abre|abrir|open|lança|lançar|launch)\b/i;
const SCREENSHOT_PATTERN = /\bscreenshot\b|\bcaptur[ae]\s+(?:de\s+)?(?:ecr[ãa]|tela)\b/i;
const LIST_FILES_PATTERN = /\blist(a|ar)?\s+(?:os\s+)?ficheiros\b|\blist\s+files\b/i;
const CREATE_FOLDER_PATTERN =
  /\bcria(?:r)?\s+uma?\s+pasta\s+(?:chamada|com\s+o\s+nome)\s+["']?([^"'.!?]+)["']?/i;
const CREATE_FOLDER_PATTERN_EN = /\bcreate\s+a\s+folder\s+(?:named|called)\s+["']?([^"'.!?]+)["']?/i;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|org|net|dev|io|pt|app)\b(?:\/[^\s]*)?/i;

function parseHeuristically(message: string): ToolIntent | null {
  const trimmed = message.trim();

  if (SCREENSHOT_PATTERN.test(trimmed)) {
    return { agentType: "COMPUTER", tool: "SCREENSHOT", input: {}, description: "Take a screenshot" };
  }

  if (LIST_FILES_PATTERN.test(trimmed)) {
    return { agentType: "COMPUTER", tool: "LIST_DIRECTORY", input: { path: "." }, description: "List workspace files" };
  }

  const folderMatch = CREATE_FOLDER_PATTERN.exec(trimmed) ?? CREATE_FOLDER_PATTERN_EN.exec(trimmed);
  if (folderMatch) {
    const name = folderMatch[1].trim();
    return { agentType: "COMPUTER", tool: "CREATE_DIRECTORY", input: { path: name }, description: `Create folder "${name}"` };
  }

  const verbMatch = OPEN_VERB.exec(trimmed);
  if (verbMatch) {
    const urlMatch = URL_PATTERN.exec(trimmed);
    if (urlMatch) {
      const raw = urlMatch[0];
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      return { agentType: "COMPUTER", tool: "OPEN_URL", input: { url }, description: `Open URL ${url}` };
    }

    // Take everything *after* the verb (there may be a "JARVIS," prefix
    // before it, e.g. "JARVIS, abre o Safari" — stripping from the whole
    // string's start would miss the app name entirely), then strip
    // leading articles/punctuation and trailing punctuation from that
    // remainder before checking it against the application allowlist —
    // reuses the exact same matcher the security layer uses, so "is this
    // a real app" is answered once.
    const remainder = trimmed
      .slice(verbMatch.index + verbMatch[0].length)
      .replace(/^[\s,]*(o|a|the)?[\s,]*/i, "")
      .replace(/[.!?]+$/, "")
      .trim();
    const classification = classifyAppOpen(remainder);
    if (classification.allowed && classification.app) {
      return {
        agentType: "COMPUTER",
        tool: "OPEN_APPLICATION",
        input: { application: classification.app.label },
        description: `Open ${classification.app.label}`,
      };
    }
  }

  return null;
}

function describeIntent(tool: ComputerCommandType, input: Record<string, unknown>): string {
  switch (tool) {
    case "OPEN_APPLICATION":
      return `Open ${input.application ?? "application"}`;
    case "OPEN_URL":
      return `Open URL ${input.url ?? ""}`;
    case "SCREENSHOT":
      return "Take a screenshot";
    case "LIST_DIRECTORY":
      return `List ${input.path ?? "."}`;
    case "CREATE_DIRECTORY":
      return `Create folder "${input.path ?? ""}"`;
    default:
      return String(tool);
  }
}
