import { ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { CreateProjectSchema } from "@/lib/validation";

export const GET = withErrorHandling(async () => {
  const { projects, user } = await getJarvis();
  const list = await projects.list(user.id);
  return ok({ projects: list });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid project payload", parsed.error.flatten());

  const { projects, user } = await getJarvis();
  const project = await projects.create({ userId: user.id, ...parsed.data });
  return ok({ project }, 201);
});
