import { google } from "googleapis";
import { getSetting, setSetting } from "@jarvis/db";
import { enforceAction } from "@jarvis/security";
import { IntegrationNotConfiguredError } from "@jarvis/shared";
import type { Agent, AgentContext, AgentExecutionResult } from "./base.js";
import { baseDescriptor } from "./base.js";

export type EmailAgentInput =
  | { op: "getAuthUrl" }
  | { op: "exchangeCode"; code: string }
  | { op: "listUnread"; maxResults?: number }
  | { op: "draft"; to: string; subject: string; body: string }
  | { op: "send"; to: string; subject: string; body: string };

interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}

function isConfigured(): boolean {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
}

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ?? "http://localhost:3000/api/email/oauth/callback",
  );
}

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
];

/**
 * Real Gmail OAuth scaffold. Nothing here is faked: without
 * GMAIL_CLIENT_ID/SECRET it reports NOT_CONFIGURED; without a completed
 * OAuth consent flow (tokens in settings) it cannot read or send anything.
 * JARVIS never sends email without an explicit, per-message approval —
 * "send" is MEDIUM_RISK even once credentials exist.
 */
export class EmailAgent implements Agent {
  readonly type = "EMAIL" as const;

  descriptor() {
    const configured = isConfigured();
    return baseDescriptor({
      type: this.type,
      name: "Email Agent",
      description: "Reads, classifies and drafts Gmail messages; sends only with explicit approval.",
      status: configured ? "IDLE" : "NOT_CONFIGURED",
      capabilities: configured ? ["OAuth connect", "list/read messages", "create drafts"] : [],
      plannedCapabilities: ["reply", "send (with approval)", "classification", "Outlook support"],
    });
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    if (!isConfigured()) {
      return {
        success: false,
        mode: "NOT_CONFIGURED",
        error: "Gmail integration requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.",
      };
    }

    const input = ctx.input as EmailAgentInput;
    const oauth2Client = buildOAuthClient();

    try {
      if (input.op === "getAuthUrl") {
        const url = oauth2Client.generateAuthUrl({ access_type: "offline", scope: GMAIL_SCOPES, prompt: "consent" });
        return { success: true, mode: "REAL", output: { url } };
      }

      if (input.op === "exchangeCode") {
        const { tokens } = await oauth2Client.getToken(input.code);
        await setSetting("gmail_tokens", tokens as StoredTokens);
        return { success: true, mode: "REAL", output: { connected: true } };
      }

      const tokens = await getSetting<StoredTokens>("gmail_tokens");
      if (!tokens?.refresh_token && !tokens?.access_token) {
        return {
          success: false,
          mode: "NOT_CONFIGURED",
          error: "Gmail credentials are configured but no account has completed OAuth consent yet.",
        };
      }
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      if (input.op === "listUnread") {
        const res = await gmail.users.messages.list({ userId: "me", q: "is:unread", maxResults: input.maxResults ?? 10 });
        return { success: true, mode: "REAL", output: { messages: res.data.messages ?? [] } };
      }

      if (input.op === "draft") {
        const check = await enforceAction({ action: "email.draft", taskId: ctx.taskId, agentType: this.type, reason: `Draft to ${input.to}` });
        if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
        const raw = buildRawMessage(input.to, input.subject, input.body);
        const res = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw } } });
        return { success: true, mode: "REAL", output: { draftId: res.data.id } };
      }

      if (input.op === "send") {
        const check = await enforceAction({ action: "email.send", taskId: ctx.taskId, agentType: this.type, reason: `Send to ${input.to}: ${input.subject}` });
        if (!check.allowed) return { success: false, mode: "REAL", requiresApproval: check.permissionRequest };
        const raw = buildRawMessage(input.to, input.subject, input.body);
        const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        return { success: true, mode: "REAL", output: { messageId: res.data.id } };
      }

      return { success: false, mode: "REAL", error: "Unknown Email Agent operation" };
    } catch (error) {
      if (error instanceof IntegrationNotConfiguredError) {
        return { success: false, mode: "NOT_CONFIGURED", error: error.message };
      }
      return { success: false, mode: "REAL", error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function buildRawMessage(to: string, subject: string, body: string): string {
  const message = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\n");
  return Buffer.from(message).toString("base64url");
}
