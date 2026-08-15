"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { EmptyState, LoadingBlock } from "./ui/EmptyState";

interface ActivityEntry {
  id: string;
  timestamp: string;
  agentType: string;
  action: string;
  result: "SUCCESS" | "FAILURE" | "PENDING";
}

const RESULT_COLOR: Record<string, string> = {
  SUCCESS: "text-accent",
  FAILURE: "text-signal-error",
  PENDING: "text-signal-warn",
};

export function ActivityPanel() {
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ activity: ActivityEntry[] }>("/api/activity?limit=8")
      .then((r) => setActivity(r.activity))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Card
      title="Activity"
      action={
        <Link href="/activity" className="text-[11px] font-mono text-accent hover:underline">
          View all →
        </Link>
      }
    >
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !activity && <LoadingBlock label="Loading activity..." />}
      {activity && activity.length === 0 && <EmptyState title="No activity yet" />}
      {activity && activity.length > 0 && (
        <ul className="space-y-1.5 font-mono text-[11px]">
          {activity.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0">
              <span className="truncate text-ink-dim">
                <span className="text-ink-faint">{entry.agentType}</span> · {entry.action}
              </span>
              <span className={RESULT_COLOR[entry.result] ?? "text-ink-faint"}>{entry.result}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
