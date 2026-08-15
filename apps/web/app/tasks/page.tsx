"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";
import { TaskRow, type Task } from "@/components/TaskRow";

const STATES = ["ALL", "PENDING", "PLANNING", "RUNNING", "WAITING_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");

  function load() {
    const qs = filter === "ALL" ? "" : `?state=${filter}`;
    api
      .get<{ tasks: Task[] }>(`/api/tasks${qs}`)
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError(e.message));
  }

  useEffect(load, [filter]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Tasks</h1>
        <p className="text-sm text-ink-faint">The persistent task queue — every step JARVIS has planned or run.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
              filter === s ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-ink-faint hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card>
        {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
        {!error && !tasks && <LoadingBlock />}
        {tasks && tasks.length === 0 && <EmptyState title="No tasks match this filter" />}
        {tasks && tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} onChange={load} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
