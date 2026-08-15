"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { EmptyState, LoadingBlock } from "./ui/EmptyState";
import { StatusBadge } from "./ui/StatusDot";

interface Task {
  id: string;
  description: string;
  state: string;
  agentType: string | null;
  progress: number;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ tasks: Task[] }>("/api/tasks")
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Card
      title="Active Tasks"
      action={
        <Link href="/tasks" className="text-[11px] font-mono text-accent hover:underline">
          View all →
        </Link>
      }
    >
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !tasks && <LoadingBlock label="Loading tasks..." />}
      {tasks && tasks.length === 0 && <EmptyState title="No tasks yet" description="Tasks appear here once a plan or agent action is created." />}
      {tasks && tasks.length > 0 && (
        <ul className="space-y-2">
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-ink-dim">{t.description}</span>
                <StatusBadge status={t.state} />
              </div>
              {t.agentType && <span className="mt-1 block font-mono text-[10px] text-ink-faint">{t.agentType}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
