import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { resolveComputerCommand, logActivity, getComputerCommand } from "@jarvis/db";
import { ok, withErrorHandling } from "@/lib/server/api";
import { requireComputerAgentToken } from "@/lib/server/computer-auth";

const ResultSchema = z.object({
  state: z.enum(["COMPLETED", "FAILED", "REJECTED"]),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  requireComputerAgentToken(request);
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = ResultSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid command result payload", parsed.error.flatten());

  const before = await getComputerCommand(id);
  const command = await resolveComputerCommand(id, parsed.data);

  const durationMs =
    before?.startedAt && command.completedAt
      ? new Date(command.completedAt).getTime() - new Date(before.startedAt).getTime()
      : null;

  await logActivity({
    agentType: "COMPUTER",
    toolName: command.type,
    action: command.type,
    result: command.state === "COMPLETED" ? "SUCCESS" : "FAILURE",
    durationMs,
    taskId: command.taskId,
    projectId: null,
    details: { commandId: command.id, error: command.error ?? undefined },
  });

  return ok({ command });
});
