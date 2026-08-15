import "server-only";
import { PermissionDeniedError, IntegrationNotConfiguredError } from "@jarvis/shared";

/**
 * Every daemon-facing route (/api/computer/device/*) goes through this
 * first. "Nunca aceitar comandos arbitrários de uma origem não
 * autenticada": if COMPUTER_AGENT_TOKEN isn't configured, the whole
 * surface refuses rather than accepting unauthenticated pairing.
 */
export function requireComputerAgentToken(request: Request): void {
  const configured = process.env.COMPUTER_AGENT_TOKEN;
  if (!configured) {
    throw new IntegrationNotConfiguredError("computer-agent");
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || token !== configured) {
    throw new PermissionDeniedError("Invalid or missing Computer Agent token.");
  }
}
