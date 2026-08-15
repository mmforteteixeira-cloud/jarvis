"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

interface PermissionRequest {
  id: string;
  action: string;
  riskLevel: string;
  reason: string;
  agentType: string | null;
}

export function PermissionsBanner() {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.get<{ permissions: PermissionRequest[] }>("/api/permissions?state=PENDING");
      setPermissions(r.permissions);
    } catch {
      // Silently ignore — this is a non-critical banner, the panels below show real errors.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

  async function resolve(id: string, decision: "approve" | "deny") {
    setBusyId(id);
    try {
      await api.post(`/api/permissions/${id}/${decision}`);
      setPermissions((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (permissions.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {permissions.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-4 rounded-md border border-signal-warn/40 bg-signal-warn/5 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-widest text-signal-warn">
              Approval needed · {p.riskLevel} · {p.agentType ?? "system"}
            </p>
            <p className="mt-1 truncate text-sm text-ink-dim">
              {p.action} — {p.reason}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              disabled={busyId === p.id}
              onClick={() => resolve(p.id, "deny")}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-ink-dim hover:border-signal-error/40 hover:text-signal-error disabled:opacity-40"
            >
              Deny
            </button>
            <button
              disabled={busyId === p.id}
              onClick={() => resolve(p.id, "approve")}
              className="rounded-md border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
