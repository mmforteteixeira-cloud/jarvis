import { z } from "zod";
import { NotFoundError, ValidationError } from "@jarvis/shared";
import { ok, withErrorHandling } from "@/lib/server/api";
import { renameConversation, deleteConversation, getConversation } from "@jarvis/db";

const RenameConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

type RouteParams = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = RenameConversationSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid conversation update", parsed.error.flatten());

  const existing = await getConversation(id);
  if (!existing) throw new NotFoundError("Conversation", id);

  const conversation = await renameConversation(id, parsed.data.title);
  return ok({ conversation });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const existing = await getConversation(id);
  if (!existing) throw new NotFoundError("Conversation", id);

  await deleteConversation(id);
  return ok({ deleted: id });
});
