"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";

interface Memory {
  id: string;
  type: string;
  content: string;
  importance: number;
  createdAt: string;
}

const TYPES = ["SHORT_TERM", "PROJECT", "TASK", "USER_PREFERENCE", "LONG_TERM"];

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>("ALL");
  const [content, setContent] = useState("");
  const [saveType, setSaveType] = useState("USER_PREFERENCE");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    const qs = type === "ALL" ? "" : `?type=${type}`;
    api
      .get<{ memories: Memory[] }>(`/api/memory${qs}`)
      .then((r) => setMemories(r.memories))
      .catch((e) => setError(e.message));
  }

  useEffect(load, [type]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.post("/api/memory", { type: saveType, content: content.trim() });
      setContent("");
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/memory/${id}`);
    load();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Memory</h1>
        <p className="text-sm text-ink-faint">
          What JARVIS remembers. Credentials are always refused — see SECURITY.md.
        </p>
      </div>

      <Card title="Add memory">
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <select
            value={saveType}
            onChange={(e) => setSaveType(e.target.value)}
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Something JARVIS should remember..."
            className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <button
            disabled={saving || !content.trim()}
            className="rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            Save
          </button>
        </form>
        {saveError && <p className="mt-2 font-mono text-xs text-signal-error">{saveError}</p>}
      </Card>

      <div className="flex flex-wrap gap-2">
        {["ALL", ...TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
              type === t ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-ink-faint hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
        {!error && !memories && <LoadingBlock />}
        {memories && memories.length === 0 && <EmptyState title="No memories yet" />}
        {memories && memories.length > 0 && (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    {m.type} · importance {m.importance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm text-ink-dim">{m.content}</p>
                </div>
                <button
                  onClick={() => remove(m.id)}
                  className="shrink-0 rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint hover:border-signal-error/40 hover:text-signal-error"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
