import { describe, expect, it } from "vitest";
import { parseReminderIntent } from "./reminder-intent.js";

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("parseReminderIntent (heuristic mode — no AI key in test env)", () => {
  it("returns null for messages that aren't reminder requests", async () => {
    expect(await parseReminderIntent("What's the weather like?", NOW)).toBeNull();
  });

  it("parses a relative-minutes reminder", async () => {
    const result = await parseReminderIntent("lembra-me daqui a 30 minutos de ligar ao dentista", NOW);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("ligar ao dentista");
    expect(new Date(result!.dueAt).getTime()).toBe(NOW.getTime() + 30 * 60_000);
  });

  it("parses a relative-hours reminder in English", async () => {
    const result = await parseReminderIntent("remind me in 2 hours to check the oven", NOW);
    expect(result).not.toBeNull();
    expect(new Date(result!.dueAt).getTime()).toBe(NOW.getTime() + 2 * 3_600_000);
  });

  it("parses 'amanhã às HH:MM' and rolls to the next day", async () => {
    const result = await parseReminderIntent("lembra-me amanhã às 10:00 de enviar o relatório", NOW);
    expect(result).not.toBeNull();
    const due = new Date(result!.dueAt);
    expect(due.getDate()).toBe(NOW.getDate() + 1);
    expect(due.getHours()).toBe(10);
  });

  it("rolls a bare clock time to tomorrow when it has already passed today", async () => {
    // NOW is 12:00 — asking for 09:00 with no explicit day means it already passed.
    const result = await parseReminderIntent("lembra-me às 9:00 de tomar o comprimido", NOW);
    expect(result).not.toBeNull();
    const due = new Date(result!.dueAt);
    expect(due.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("defaults to 09:00 when only 'amanhã' is given with no explicit time", async () => {
    const result = await parseReminderIntent("lembra-me amanhã de comprar leite", NOW);
    expect(result).not.toBeNull();
    const due = new Date(result!.dueAt);
    expect(due.getHours()).toBe(9);
  });
});
