"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card } from "./ui/Card";
import { EmptyState, LoadingBlock } from "./ui/EmptyState";
import { StatusBadge } from "./ui/StatusDot";

interface Project {
  id: string;
  name: string;
  status: string;
  priority: string;
  updatedAt: string;
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ projects: Project[] }>("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Card
      title="Active Projects"
      action={
        <Link href="/projects" className="text-[11px] font-mono text-accent hover:underline">
          View all →
        </Link>
      }
    >
      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !projects && <LoadingBlock label="Loading projects..." />}
      {projects && projects.length === 0 && (
        <EmptyState title="No projects yet" description='Try: "Cria uma aplicação de currículos" in the chat.' />
      )}
      {projects && projects.length > 0 && (
        <ul className="space-y-2">
          {projects.slice(0, 5).map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent/40 hover:bg-surface-raised"
              >
                <span className="truncate text-ink-dim">{p.name}</span>
                <StatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
