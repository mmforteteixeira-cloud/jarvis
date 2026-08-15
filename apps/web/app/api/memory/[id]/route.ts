import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { ok, withErrorHandling } from "@/lib/server/api";
import { updateMemory, deleteMemory } from "@jarvis/memory";

const UpdateMemorySchema = z.object({
  content: z.string().min(1).max(4000).optional(),
  importance: z.number().min(0).max(1).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateMemorySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid memory update", parsed.error.flatten());
  const memory = await updateMemory(id, parsed.data);
  return ok({ memory });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  await deleteMemory(id);
  return ok({ deleted: id });
});
