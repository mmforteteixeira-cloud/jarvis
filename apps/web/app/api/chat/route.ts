import { ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listConversations, listMessages } from "@jarvis/db";
import { ChatRequestSchema } from "@/lib/validation";

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid chat request", parsed.error.flatten());
  }

  const { jarvisCore, user } = await getJarvis();
  const response = await jarvisCore.chat({
    userId: user.id,
    conversationId: parsed.data.conversationId,
    message: parsed.data.message,
  });

  return ok(response);
});

export const GET = withErrorHandling(async (request: Request) => {
  const { user } = await getJarvis();
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (conversationId) {
    const messages = await listMessages(conversationId);
    return ok({ messages });
  }

  const conversations = await listConversations(user.id);
  return ok({ conversations });
});
