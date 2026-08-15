import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { createReminder, listReminders } from "@jarvis/db";

const CreateReminderSchema = z.object({
  message: z.string().min(1).max(500),
  dueAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "dueAt must be a valid date"),
});

export const GET = withErrorHandling(async () => {
  const { user } = await getJarvis();
  const reminders = await listReminders(user.id);
  return ok({ reminders });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = CreateReminderSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid reminder payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const reminder = await createReminder({
    userId: user.id,
    message: parsed.data.message,
    dueAt: new Date(parsed.data.dueAt).toISOString(),
  });
  return ok({ reminder }, 201);
});
