"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { StatusBadge } from "./ui/StatusDot";

export interface Task {
  id: string;
  description: string;
  state: string;
  agentType: string | null;
  priority: string;
  progress: number;
  error: string | null;
}

export function TaskRow({ task, onChange }: { task: Task; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function run(action: "execute" | "cancel" | "retry") {
    setBusy(true);
    try {
      await api.post(`/api/tasks/${task.id}/${action}`);
      onChange();
    } catch {
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const canExecute = task.state === "PENDING" && task.agentType;
  const canCancel = ["PENDING", "PLANNING", "RUNNING", "WAITING_APPROVAL"].includes(task.state);
  const canRetry = task.state === "FAILED";

  return (
    <li className="rounded-md border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{task.description}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-faint">
            {task.agentType ?? "no agent · plan step"} · {task.priority}
          </p>
          {task.error && <p className="mt-1 font-mono text-[11px] text-signal-error">{task.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={task.state} />
        </div>
      </div>

      {(canExecute || canCancel || canRetry) && (
        <div className="mt-2 flex gap-2">
          {canExecute && (
            <ActionButton busy={busy} onClick={() => run("execute")} label="Run" tone="accent" />
          )}
          {canRetry && <ActionButton busy={busy} onClick={() => run("retry")} label="Retry" tone="warn" />}
          {canCancel && <ActionButton busy={busy} onClick={() => run("cancel")} label="Cancel" tone="error" />}
        </div>
      )}
    </li>
  );
}

function ActionButton({
  onClick,
  label,
  busy,
  tone,
}: {
  onClick: () => void;
  label: string;
  busy: boolean;
  tone: "accent" | "warn" | "error";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/40 text-accent hover:bg-accent/10"
      : tone === "warn"
        ? "border-signal-warn/40 text-signal-warn hover:bg-signal-warn/10"
        : "border-signal-error/40 text-signal-error hover:bg-signal-error/10";
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40 ${toneClass}`}
    >
      {label}
    </button>
  );
}
