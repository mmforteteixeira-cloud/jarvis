"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { StatusBadge } from "./ui/StatusDot";

interface SystemStatus {
  status: "ONLINE" | "BUSY" | "OFFLINE";
  aiProvider: { name: string; mode: "REAL" | "DEMO"; model: string };
  counts: { runningTasks: number; waitingApproval: number; pendingPermissions: number; agentsWorking: number; agentsIdle: number };
}

export function TopBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<SystemStatus>("/api/system/status");
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus(null);
      }
    }
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/70 px-6">
      <div className="flex items-center gap-3">
        <StatusBadge status={status?.status ?? "OFFLINE"} />
        <span className="text-sm text-ink-dim">"How can I help?"</span>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px] text-ink-faint">
        {status && (
          <>
            <span title={`AI provider: ${status.aiProvider.name} (${status.aiProvider.model})`}>
              AI: <span className={status.aiProvider.mode === "REAL" ? "text-accent" : "text-signal-warn"}>{status.aiProvider.mode}</span>
            </span>
            <span>Running: {status.counts.runningTasks}</span>
            {status.counts.waitingApproval > 0 && (
              <span className="text-signal-warn">Awaiting approval: {status.counts.waitingApproval}</span>
            )}
          </>
        )}
      </div>
    </header>
  );
}
