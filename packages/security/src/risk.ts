import type { RiskLevel } from "@jarvis/shared";

/**
 * Central catalog mapping known actions to a risk level. This is the single
 * source of truth the whole system consults before letting an agent do
 * anything — new tools/agents must register their actions here rather than
 * deciding risk ad hoc at the call site.
 */
export const ACTION_RISK_CATALOG: Record<string, RiskLevel> = {
  // LOW_RISK — read-only or sandboxed-workspace actions
  "file.read": "LOW_RISK",
  "file.list": "LOW_RISK",
  "file.write.workspace": "LOW_RISK",
  "file.create.workspace": "LOW_RISK",
  "shell.exec.test": "LOW_RISK",
  "research.search": "LOW_RISK",
  "research.summarize": "LOW_RISK",
  "browser.navigate": "LOW_RISK",
  "browser.read": "LOW_RISK",
  "browser.screenshot": "LOW_RISK",
  "memory.read": "LOW_RISK",
  "content.draft": "LOW_RISK",

  // MEDIUM_RISK — sends data out, changes config, publishes
  "email.send": "MEDIUM_RISK",
  "email.draft": "LOW_RISK",
  "browser.interact": "MEDIUM_RISK",
  "content.publish": "MEDIUM_RISK",
  "settings.modify": "MEDIUM_RISK",
  "shell.exec.general": "MEDIUM_RISK",
  "computer.open_app": "MEDIUM_RISK",
  "computer.control": "MEDIUM_RISK",

  // HIGH_RISK — destructive or irreversible
  "file.delete": "HIGH_RISK",
  "file.delete.outside_workspace": "HIGH_RISK",
  "shell.exec.destructive": "HIGH_RISK",
  "financial.transaction": "HIGH_RISK",
  "account.delete": "HIGH_RISK",
  "data.irreversible_change": "HIGH_RISK",
};

export function classifyAction(action: string): RiskLevel {
  return ACTION_RISK_CATALOG[action] ?? "HIGH_RISK"; // fail closed: unknown action = highest scrutiny
}
