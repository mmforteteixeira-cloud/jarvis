import { describe, expect, it } from "vitest";
import { getOrCreateDefaultUser } from "./users.js";
import { createReminder, listReminders, listDueReminders, markReminderFired, cancelReminder } from "./reminders.js";

async function testUser() {
  return getOrCreateDefaultUser(`test-${Date.now()}-${Math.random()}@local`, "Test User");
}

describe("reminders", () => {
  it("creates a reminder in PENDING state", async () => {
    const user = await testUser();
    const reminder = await createReminder({ userId: user.id, message: "Call the dentist", dueAt: "2026-01-01T09:00:00.000Z" });
    expect(reminder.status).toBe("PENDING");
    expect(reminder.firedAt).toBeNull();
  });

  it("lists a user's reminders ordered by due date", async () => {
    const user = await testUser();
    await createReminder({ userId: user.id, message: "Second", dueAt: "2026-02-01T09:00:00.000Z" });
    await createReminder({ userId: user.id, message: "First", dueAt: "2026-01-01T09:00:00.000Z" });
    const list = await listReminders(user.id);
    expect(list.map((r) => r.message)).toEqual(["First", "Second"]);
  });

  it("only returns PENDING reminders that are due", async () => {
    const user = await testUser();
    const past = await createReminder({ userId: user.id, message: "Overdue", dueAt: "2020-01-01T00:00:00.000Z" });
    await createReminder({ userId: user.id, message: "Future", dueAt: "2099-01-01T00:00:00.000Z" });

    const due = await listDueReminders(new Date().toISOString());
    expect(due.some((r) => r.id === past.id)).toBe(true);
    expect(due.some((r) => r.message === "Future")).toBe(false);
  });

  it("excludes fired and cancelled reminders from the due list", async () => {
    const user = await testUser();
    const fired = await createReminder({ userId: user.id, message: "Fired one", dueAt: "2020-01-01T00:00:00.000Z" });
    const cancelled = await createReminder({ userId: user.id, message: "Cancelled one", dueAt: "2020-01-01T00:00:00.000Z" });

    await markReminderFired(fired.id);
    await cancelReminder(cancelled.id);

    const due = await listDueReminders(new Date().toISOString());
    expect(due.some((r) => r.id === fired.id)).toBe(false);
    expect(due.some((r) => r.id === cancelled.id)).toBe(false);
  });
});
