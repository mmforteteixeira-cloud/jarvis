import "server-only";
import { RateLimitedError } from "@jarvis/shared";
import { checkRateLimit } from "@jarvis/security";

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "local";
}

/**
 * Enforces a per-client, per-route rate limit. Throws RateLimitedError
 * (mapped to HTTP 429 by withErrorHandling) when exceeded. Call at the top
 * of a route handler, before any expensive work (AI calls, task execution).
 */
export function enforceRateLimit(request: Request, routeName: string, limit: number, windowMs: number): void {
  const key = `${routeName}:${clientKey(request)}`;
  const result = checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new RateLimitedError(result.retryAfterMs);
  }
}
