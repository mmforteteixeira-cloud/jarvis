import { NotFoundError, ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listTasks } from "@jarvis/db";
import { UpdateProjectSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const { projects } = await getJarvis();
  const project = await projects.get(id);
  if (!project) throw new NotFoundError("Project", id);
  const tasks = await listTasks({ projectId: id });
  return ok({ project, tasks });
});

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid project update", parsed.error.flatten());

  const { projects } = await getJarvis();
  const { status, ...rest } = parsed.data;
  let project = Object.keys(rest).length > 0 ? await projects.update(id, rest) : await projects.get(id);
  if (!project) throw new NotFoundError("Project", id);
  if (status) project = await projects.transition(id, status);
  return ok({ project });
});
