"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusDot";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    api
      .get<{ projects: Project[] }>("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/projects", { name: name.trim(), description, goal: description });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Projects</h1>
        <p className="text-sm text-ink-faint">
          Create a bare project here, or ask JARVIS in chat to plan one from a goal.
        </p>
      </div>

      <Card title="New project">
        <form onSubmit={createProject} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-faint">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent/50"
              placeholder="Personal website"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-faint">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent/50"
              placeholder="Optional"
            />
          </div>
          <button
            disabled={creating || !name.trim()}
            className="rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            Create
          </button>
        </form>
      </Card>

      <Card title="All projects">
        {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
        {!error && !projects && <LoadingBlock />}
        {projects && projects.length === 0 && <EmptyState title="No projects yet" />}
        {projects && projects.length > 0 && (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:border-accent/40 hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{p.name}</p>
                    <p className="truncate text-xs text-ink-faint">{p.description || "No description"}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
