"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusDot";
import { TaskRow, type Task } from "@/components/TaskRow";

interface Project {
  id: string;
  name: string;
  description: string;
  goal: string;
  status: string;
  priority: string;
}

const PROJECT_STATES = ["PLANNING", "IN_PROGRESS", "TESTING", "WAITING", "COMPLETED", "FAILED", "ARCHIVED"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<{ project: Project; tasks: Task[] }>(`/api/projects/${id}`)
      .then((r) => {
        setProject(r.project);
        setTasks(r.tasks);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function setStatus(status: string) {
    await api.patch(`/api/projects/${id}`, { status });
    load();
  }

  if (error) return <p className="font-mono text-sm text-signal-error">{error}</p>;
  if (!project) return <LoadingBlock label="Loading project..." />;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-lg text-ink">{project.name}</h1>
            <p className="mt-1 text-sm text-ink-dim">{project.description || project.goal}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {PROJECT_STATES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              disabled={s === project.status}
              className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint hover:border-accent/40 hover:text-accent disabled:cursor-default disabled:opacity-30"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      <Card title={`Tasks (${tasks.length})`}>
        {tasks.length === 0 && <EmptyState title="No tasks in this project yet" />}
        {tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} onChange={load} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
