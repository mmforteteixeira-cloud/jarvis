import "server-only";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@jarvis/shared";

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json(data, { status: init ?? 200 });
}

/** Wraps a route handler so thrown JarvisErrors become clean JSON error
 * responses instead of an opaque 500 / white-screen. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const { code, message, statusCode, details } = toErrorResponse(error);
      console.error(JSON.stringify({ level: "error", code, message, details }));
      return NextResponse.json({ error: { code, message, details } }, { status: statusCode });
    }
  };
}
