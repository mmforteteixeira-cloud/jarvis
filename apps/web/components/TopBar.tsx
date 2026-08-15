"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { StatusBadge } from "./ui/StatusDot";
import { useAppUI } from "./providers";

interface SystemStatus {
  status: "ONLINE" | "BUSY" | "OFFLINE";
  aiProvider: { name: string; mode: "REAL" | "DEMO"; model: string };
  counts: { runningTasks: number; waitingApproval: number; pendingPermissions: number; agentsWorking: number; agentsIdle: number };
}

export function TopBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const { setSidebarOpen } = useAppUI();

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/70 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-md border border-border p-1.5 text-ink-dim hover:text-ink lg:hidden"
          aria-label="Open menu"
        >
          ☰
        </button>
        <StatusBadge status={status?.status ?? "OFFLINE"} />
        <span className="hidden text-sm text-ink-dim sm:inline">"How can I help?"</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-ink-faint sm:gap-4">
        {status && (
          <>
            <span
              className="hidden sm:inline"
              title={`AI provider: ${status.aiProvider.name} (${status.aiProvider.model})`}
            >
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
