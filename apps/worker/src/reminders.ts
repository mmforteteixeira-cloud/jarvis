import { createLogger } from "@jarvis/shared";
import { listDueReminders, markReminderFired, createNotification } from "@jarvis/db";

const logger = createLogger("worker:reminders");

/**
 * Fires due reminders as notifications. This is the other half of "JARVIS,
 * lembra-me amanhã às 10" — jarvis-core.ts persists the reminder when asked,
 * this tick is what actually surfaces it once its time comes.
 */
export async function runReminderTick(): Promise<void> {
  const due = await listDueReminders();

  for (const reminder of due) {
    try {
      await markReminderFired(reminder.id);
      await createNotification({
        userId: reminder.userId,
        title: "Reminder",
        message: reminder.message,
        severity: "info",
      });
      logger.info("Reminder fired", { reminderId: reminder.id });
    } catch (error) {
      logger.error("Failed to fire reminder", { reminderId: reminder.id, error: (error as Error).message });
    }
  }
}
