import type { RiskLevel } from "@jarvis/shared";

/**
 * Computer Agent command policy — the rules the daemon (running on the
 * user's own machine) applies to itself before executing anything, and
 * that the server applies before even queuing a command. Both sides run
 * this same logic independently: the server decides whether a command
 * *may* be queued (and whether it needs approval); the daemon decides
 * whether it's actually willing to run it, regardless of what the server
 * said. Neither side trusts the other blindly.
 */
export const COMPUTER_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "BLOCKED"] as const;
export type ComputerRisk = (typeof COMPUTER_RISK_LEVELS)[number];

/** BLOCKED has no equivalent in the general RiskLevel scale — it's not
 * "high risk requiring approval", it's "never, under any circumstances". */
export function toRiskLevel(risk: Exclude<ComputerRisk, "BLOCKED">): RiskLevel {
  return risk === "LOW" ? "LOW_RISK" : risk === "MEDIUM" ? "MEDIUM_RISK" : "HIGH_RISK";
}

// ---------------------------------------------------------------------------
// Application allowlist (OPEN_APPLICATION)
// ---------------------------------------------------------------------------

export interface AppDefinition {
  /** Canonical display name. */
  label: string;
  /** Aliases a user might say/type — matched case-insensitively. */
  aliases: string[];
  /** `open -a "<macApp>"` on macOS. */
  macApp: string;
  /** Best-effort binary/desktop-launcher name on Linux, for local dev/testing. */
  linuxCommand?: string;
}

export const DEFAULT_APP_ALLOWLIST: AppDefinition[] = [
  { label: "Safari", aliases: ["safari"], macApp: "Safari" },
  { label: "Terminal", aliases: ["terminal"], macApp: "Terminal", linuxCommand: "x-terminal-emulator" },
  { label: "Visual Studio Code", aliases: ["visual studio code", "vs code", "vscode", "code"], macApp: "Visual Studio Code", linuxCommand: "code" },
  { label: "Finder", aliases: ["finder"], macApp: "Finder" },
  { label: "Notes", aliases: ["notes"], macApp: "Notes" },
  { label: "Calculator", aliases: ["calculator"], macApp: "Calculator", linuxCommand: "gnome-calculator" },
  { label: "Google Chrome", aliases: ["chrome", "google chrome"], macApp: "Google Chrome", linuxCommand: "google-chrome" },
  { label: "Firefox", aliases: ["firefox"], macApp: "Firefox", linuxCommand: "firefox" },
];

export interface AppClassification {
  allowed: boolean;
  risk: ComputerRisk;
  app?: AppDefinition;
}

/** Opening an allow-listed, known-safe application is LOW risk — it's
 * reversible, common, and exactly what a developer assistant should be
 * able to do without friction. Anything not on the list is BLOCKED
 * outright (not "ask for approval"): an arbitrary/unknown binary name is
 * not something JARVIS should ever launch on your behalf. */
export function classifyAppOpen(appName: string, allowlist: AppDefinition[] = DEFAULT_APP_ALLOWLIST): AppClassification {
  const needle = appName.trim().toLowerCase();
  const app = allowlist.find((a) => a.aliases.includes(needle) || a.label.toLowerCase() === needle);
  if (!app) return { allowed: false, risk: "BLOCKED" };
  return { allowed: true, risk: "LOW", app };
}

// ---------------------------------------------------------------------------
// URL safety (OPEN_URL)
// ---------------------------------------------------------------------------

const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

export function isSafeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return SAFE_URL_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shell command classification (RUN_COMMAND)
// ---------------------------------------------------------------------------

// Absolute refusals — pattern matched against the full "command arg1 arg2"
// string. Never executed, never even offered for approval.
const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\s+(\/|~)?\s*$/i, // rm -rf / or rm -rf ~
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\s+.*\bof=\/dev\//i,
  />\s*\/dev\/(sda|nvme|disk)/i,
  /:\(\)\s*\{\s*:\|\s*:&\s*\}\s*;\s*:/, // fork bomb
  /\bsudo\b/i,
  /\/etc\/(shadow|passwd|sudoers)\b/i,
  /\.ssh\/(id_rsa|id_ed25519|id_ecdsa)\b/i,
  /\bsecurity\s+(find-generic-password|find-internet-password|dump-keychain)\b/i, // macOS Keychain access
  /\b(curl|wget)\b.*\|\s*(sh|bash|zsh)\b/i, // piping a remote script straight into a shell
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
  /\bdiskutil\s+(erase|partition)/i,
  /\bkillall\s+-9\s+(kernel_task|launchd|WindowServer)/i,
];

// Exact-match (command + args) allowlist for zero-friction developer commands.
const LOW_RISK_COMMANDS = new Set([
  "pwd",
  "ls",
  "whoami",
  "date",
  "echo",
  "git status",
  "git log",
  "git diff",
  "git branch",
  "npm test",
  "npm run test",
  "npm run build",
  "npm run lint",
  "pnpm test",
  "pnpm build",
  "pnpm lint",
]);

// Prefix-match for commands that change local state but are common/expected
// developer actions ("npm install", "git pull …", "npm run dev …", etc.).
const MEDIUM_RISK_PREFIXES = [
  "npm install",
  "npm i ",
  "pnpm install",
  "pnpm add",
  "yarn install",
  "git pull",
  "git push",
  "git clone",
  "npm run dev",
  "npm start",
  "npm run start",
  "pnpm dev",
  "pnpm start",
  "docker ",
];

export function classifyShellCommand(command: string, args: string[] = []): ComputerRisk {
  const full = [command, ...args].join(" ").trim();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(full)) return "BLOCKED";
  }
  if (LOW_RISK_COMMANDS.has(full)) return "LOW";
  if (MEDIUM_RISK_PREFIXES.some((prefix) => full.startsWith(prefix))) return "MEDIUM";

  // Unrecognized command: fail closed, same philosophy as the general
  // ACTION_RISK_CATALOG in risk.ts.
  return "HIGH";
}

// ---------------------------------------------------------------------------
// Sensitive paths — blocked even *inside* an otherwise-authorized sandbox
// ---------------------------------------------------------------------------

const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.[^.]+)?$/i, // .env, .env.local, etc — but not .env.example
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.gnupg(\/|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/i,
  /(^|\/)credentials(\.json)?$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.git-credentials$/i,
];

export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (/(^|\/)\.env\.example$/i.test(normalized)) return false;
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}
