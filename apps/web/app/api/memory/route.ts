import { z } from "zod";
import { ValidationError, MEMORY_TYPES } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { saveMemory, searchMemory } from "@jarvis/memory";

const SaveMemorySchema = z.object({
  type: z.enum(MEMORY_TYPES),
  content: z.string().min(1).max(4000),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  importance: z.number().min(0).max(1).optional(),
});

export const GET = withErrorHandling(async (request: Request) => {
  const { user } = await getJarvis();
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? undefined;
  const type = typeParam && (MEMORY_TYPES as readonly string[]).includes(typeParam) ? (typeParam as (typeof MEMORY_TYPES)[number]) : undefined;
  const query = url.searchParams.get("q") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;

  const memories = await searchMemory({ userId: user.id, type, query, projectId });
  return ok({ memories });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = SaveMemorySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid memory payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const memory = await saveMemory({ userId: user.id, ...parsed.data });
  return ok({ memory }, 201);
});
