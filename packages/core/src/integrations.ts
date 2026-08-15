import type { IntegrationCategory, IntegrationDescriptor } from "@jarvis/shared";

interface IntegrationSpec {
  id: string;
  category: IntegrationCategory;
  name: string;
  requiredEnvVars: string[];
  detailWhenConnected: string;
  detailWhenMissing: string;
  /** Integrations that work without any key (e.g. sqlite, browser) are REAL by default. */
  alwaysReal?: boolean;
}

const SPECS: IntegrationSpec[] = [
  {
    id: "anthropic",
    category: "AI",
    name: "Anthropic (Claude)",
    requiredEnvVars: ["AI_API_KEY"],
    detailWhenConnected: "JARVIS Core, Orchestrator, Planner and Content Agent use Claude for reasoning.",
    detailWhenMissing: "Running in heuristic DEMO mode — deterministic responses only, no real reasoning.",
  },
  {
    id: "openai",
    category: "AI",
    name: "OpenAI (fallback)",
    requiredEnvVars: ["OPENAI_API_KEY"],
    detailWhenConnected: "Available as a fallback AI provider.",
    detailWhenMissing: "Optional secondary provider — not required if Anthropic is configured.",
  },
  {
    id: "elevenlabs",
    category: "VOICE",
    name: "ElevenLabs",
    requiredEnvVars: ["ELEVENLABS_API_KEY"],
    detailWhenConnected: "High-quality TTS/STT available.",
    detailWhenMissing: "Falls back to the browser's built-in Web Speech API (free, lower quality).",
  },
  {
    id: "browser-speech",
    category: "VOICE",
    name: "Browser Speech (Web Speech API)",
    requiredEnvVars: [],
    alwaysReal: true,
    detailWhenConnected: "Zero-cost STT/TTS running locally in the browser (Chrome/Edge).",
    detailWhenMissing: "",
  },
  {
    id: "gmail",
    category: "EMAIL",
    name: "Gmail",
    requiredEnvVars: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"],
    detailWhenConnected: "OAuth configured — connect an account from the Integrations page to finish setup.",
    detailWhenMissing: "Email Agent architecture is ready; needs Gmail OAuth credentials.",
  },
  {
    id: "tiktok",
    category: "TIKTOK",
    name: "TikTok",
    requiredEnvVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    detailWhenConnected: "OAuth configured for the Content Agent's publishing flow.",
    detailWhenMissing: "Content Agent can draft scripts/hashtags now; publishing needs TikTok API credentials.",
  },
  {
    id: "github",
    category: "GITHUB",
    name: "GitHub",
    requiredEnvVars: ["GITHUB_TOKEN"],
    detailWhenConnected: "Developer Agent can use the GitHub API for repos/PRs.",
    detailWhenMissing: "Developer Agent still works locally (git CLI); GitHub API calls need a token.",
  },
  {
    id: "browser-agent",
    category: "BROWSER",
    name: "Headless Chromium",
    requiredEnvVars: [],
    alwaysReal: true,
    detailWhenConnected: "Playwright + Chromium installed — Browser Agent can navigate and read pages now.",
    detailWhenMissing: "",
  },
  {
    id: "computer-agent",
    category: "COMPUTER",
    name: "Computer Agent (local device)",
    requiredEnvVars: ["COMPUTER_AGENT_TOKEN"],
    detailWhenConnected: "Pairing secret is set, but no local daemon has connected yet.",
    detailWhenMissing: "Protocol and security model are implemented; no device has ever been paired.",
  },
  {
    id: "database",
    category: "DATABASE",
    name: "SQLite (local)",
    requiredEnvVars: [],
    alwaysReal: true,
    detailWhenConnected: "Local file database at DATABASE_URL — zero cost, zero setup.",
    detailWhenMissing: "",
  },
  {
    id: "search",
    category: "SEARCH",
    name: "Brave Search",
    requiredEnvVars: ["SEARCH_API_KEY"],
    detailWhenConnected: "Research Agent can search the web.",
    detailWhenMissing: "Research Agent cannot search the web without a SEARCH_API_KEY.",
  },
];

export function getIntegrationDescriptors(): IntegrationDescriptor[] {
  return SPECS.map((spec) => {
    const missing = spec.requiredEnvVars.filter((v) => !process.env[v]);
    const configured = spec.requiredEnvVars.filter((v) => process.env[v]);
    const isConnected = spec.alwaysReal || missing.length === 0;

    return {
      id: spec.id,
      category: spec.category,
      name: spec.name,
      status: isConnected ? "CONNECTED" : missing.length < spec.requiredEnvVars.length ? "CONFIGURATION_REQUIRED" : "NOT_CONNECTED",
      mode: isConnected ? "REAL" : "NOT_CONFIGURED",
      detail: isConnected ? spec.detailWhenConnected : spec.detailWhenMissing,
      configuredEnvVars: configured,
      missingEnvVars: missing,
    };
  });
}
