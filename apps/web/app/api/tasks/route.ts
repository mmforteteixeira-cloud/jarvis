import { ValidationError, TASK_STATES } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { CreateTaskSchema } from "@/lib/validation";

export const GET = withErrorHandling(async (request: Request) => {
  const { taskEngine } = await getJarvis();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const stateParam = url.searchParams.get("state") ?? undefined;
  const state = stateParam && (TASK_STATES as readonly string[]).includes(stateParam) ? (stateParam as (typeof TASK_STATES)[number]) : undefined;

  const tasks = await taskEngine.list({ projectId, state });
  return ok({ tasks });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid task payload", parsed.error.flatten());

  const { taskEngine } = await getJarvis();
  const task = await taskEngine.create(parsed.data);
  return ok({ task }, 201);
});
