"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";

interface ActivityEntry {
  id: string;
  timestamp: string;
  agentType: string;
  toolName: string | null;
  action: string;
  result: "SUCCESS" | "FAILURE" | "PENDING";
  durationMs: number | null;
}

const RESULT_COLOR: Record<string, string> = {
  SUCCESS: "text-accent",
  FAILURE: "text-signal-error",
  PENDING: "text-signal-warn",
};

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ activity: ActivityEntry[] }>("/api/activity?limit=200")
      .then((r) => setActivity(r.activity))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Activity Log</h1>
        <p className="text-sm text-ink-faint">Every action taken by JARVIS Core, the Orchestrator and its agents.</p>
      </div>

      <Card>
        {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
        {!error && !activity && <LoadingBlock />}
        {activity && activity.length === 0 && <EmptyState title="No activity recorded yet" />}
        {activity && activity.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-ink-faint">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 text-ink-faint">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 pr-4 text-ink-dim">{entry.agentType}</td>
                    <td className="py-2 pr-4 text-ink-dim">{entry.action}</td>
                    <td className="py-2 pr-4 text-ink-faint">{entry.durationMs != null ? `${entry.durationMs}ms` : "—"}</td>
                    <td className={`py-2 ${RESULT_COLOR[entry.result] ?? "text-ink-faint"}`}>{entry.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
