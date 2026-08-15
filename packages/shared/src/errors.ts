/**
 * Base error type for all JARVIS domain errors. Carries a stable `code` so
 * API routes and the UI can branch on error type without string matching.
 */
export class JarvisError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "JarvisError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends JarvisError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} "${id}" was not found.`, 404);
  }
}

export class ValidationError extends JarvisError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class PermissionDeniedError extends JarvisError {
  constructor(message: string, details?: unknown) {
    super("PERMISSION_DENIED", message, 403, details);
  }
}

export class ApprovalRequiredError extends JarvisError {
  constructor(message: string, details?: unknown) {
    super("APPROVAL_REQUIRED", message, 202, details);
  }
}

export class RateLimitedError extends JarvisError {
  constructor(retryAfterMs: number) {
    super("RATE_LIMITED", `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`, 429, { retryAfterMs });
  }
}

export class IntegrationNotConfiguredError extends JarvisError {
  constructor(integration: string) {
    super(
      "INTEGRATION_NOT_CONFIGURED",
      `The "${integration}" integration is not configured. Add the required environment variables to enable it.`,
      501,
      { integration },
    );
  }
}

export function toErrorResponse(error: unknown): { code: string; message: string; statusCode: number; details?: unknown } {
  if (error instanceof JarvisError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode, details: error.details };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message, statusCode: 500 };
  }
  return { code: "UNKNOWN_ERROR", message: "An unknown error occurred.", statusCode: 500 };
}
