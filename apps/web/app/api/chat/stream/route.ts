import { NextResponse } from "next/server";
import { ValidationError, toErrorResponse } from "@jarvis/shared";
import { getAIProvider } from "@jarvis/ai";
import type { ChatResponse, StreamPreparation } from "@jarvis/core";
import { getJarvis } from "@/lib/server/init";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { ChatRequestSchema } from "@/lib/validation";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function errorResponse(error: unknown): NextResponse {
  const { code, message, statusCode, details } = toErrorResponse(error);
  return NextResponse.json({ error: { code, message, details } }, { status: statusCode });
}

/**
 * SSE variant of POST /api/chat. Tool/goal intents resolve exactly like the
 * non-streaming endpoint (they aren't meaningfully streamable — a computer
 * command either ran or it didn't) and are delivered as a single "final"
 * event. Plain conversational replies stream token-by-token as "token"
 * events, then a closing "final" event with the persisted message — same
 * response shape the non-streaming endpoint returns, so the client can
 * treat both the same way once the stream ends.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "chat-stream", 20, 60_000);
  } catch (error) {
    return errorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(new ValidationError("Invalid chat request", parsed.error.flatten()));
  }

  let prep: ChatResponse | StreamPreparation;
  try {
    const { jarvisCore, user } = await getJarvis();
    prep = await jarvisCore.prepareChatStream({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
    });
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();

  if (!("finalize" in prep)) {
    const finalResponse = prep;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent("final", finalResponse)));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  const streamPrep = prep;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sseEvent("start", { conversationId: streamPrep.conversationId })));
      try {
        const ai = getAIProvider();
        const result = await ai.completeStream({ system: streamPrep.system, messages: streamPrep.messages }, (delta) => {
          controller.enqueue(encoder.encode(sseEvent("token", { delta })));
        });
        const response = await streamPrep.finalize(result.text, result.mode);
        controller.enqueue(encoder.encode(sseEvent("final", response)));
      } catch (error) {
        const { message } = toErrorResponse(error);
        controller.enqueue(encoder.encode(sseEvent("error", { message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
