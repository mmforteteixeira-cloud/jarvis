"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { EmptyState, LoadingBlock } from "./ui/EmptyState";

interface Reminder {
  id: string;
  message: string;
  dueAt: string;
  status: "PENDING" | "FIRED" | "CANCELLED";
}

function formatDue(iso: string): string {
  const due = new Date(iso);
  const diffMs = due.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  const label =
    minutes < 60
      ? `${minutes}m`
      : minutes < 1440
        ? `${Math.round(minutes / 60)}h`
        : `${Math.round(minutes / 1440)}d`;
  return diffMs >= 0 ? `in ${label}` : `${label} ago`;
}

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<{ reminders: Reminder[] }>("/api/reminders")
      .then((r) => setReminders(r.reminders.filter((rem) => rem.status === "PENDING")))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function cancel(id: string) {
    setReminders((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await api.del(`/api/reminders/${id}`);
    } catch {
      load();
    }
  }

  return (
    <Card title="Reminders">
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !reminders && <LoadingBlock label="Loading reminders..." />}
      {reminders && reminders.length === 0 && (
        <EmptyState title="No reminders" description='Try "JARVIS, lembra-me amanhã às 10 de..." in chat.' />
      )}
      {reminders && reminders.length > 0 && (
        <ul className="space-y-2">
          {reminders.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-ink-dim">{r.message}</p>
                <p className="font-mono text-[10px] text-ink-faint">{formatDue(r.dueAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => cancel(r.id)}
                className="shrink-0 font-mono text-[11px] text-ink-faint hover:text-signal-error"
                aria-label="Cancel reminder"
                title="Cancel"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
