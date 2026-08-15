"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { LoadingBlock } from "./ui/EmptyState";

interface SystemStatus {
  status: string;
  aiProvider: { name: string; mode: "REAL" | "DEMO"; model: string };
  worker: { running: boolean; lastBeatAt: string | null };
  counts: { runningTasks: number; waitingApproval: number; pendingPermissions: number; agentsWorking: number; agentsIdle: number };
}

export function SystemStatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .get<SystemStatus>("/api/system/status")
        .then((r) => !cancelled && setStatus(r))
        .catch((e) => !cancelled && setError(e.message));
    }
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card title="System Status">
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !status && <LoadingBlock label="Checking system..." />}
      {status && (
        <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
          <Metric label="Status" value={status.status} />
          <Metric label="AI Provider" value={`${status.aiProvider.name} (${status.aiProvider.mode})`} />
          <Metric label="Background worker" value={status.worker.running ? "RUNNING" : "NOT RUNNING"} />
          <Metric label="Running tasks" value={String(status.counts.runningTasks)} />
          <Metric label="Awaiting approval" value={String(status.counts.waitingApproval)} />
          <Metric label="Agents working" value={String(status.counts.agentsWorking)} />
          <Metric label="Agents idle" value={String(status.counts.agentsIdle)} />
        </dl>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-ink-faint">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  );
}
