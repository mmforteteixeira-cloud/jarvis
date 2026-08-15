"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { LoadingBlock } from "./ui/EmptyState";
import { StatusBadge } from "./ui/StatusDot";

interface AgentDescriptor {
  type: string;
  name: string;
  status: string;
}

export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentDescriptor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ agents: AgentDescriptor[] }>("/api/agents")
      .then((r) => setAgents(r.agents))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Card
      title="Agents"
      action={
        <Link href="/agents" className="text-[11px] font-mono text-accent hover:underline">
          View all →
        </Link>
      }
    >
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !agents && <LoadingBlock label="Loading agents..." />}
      {agents && (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.type} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-ink-dim">{a.name}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
