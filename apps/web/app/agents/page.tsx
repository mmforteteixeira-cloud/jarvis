"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { createAndRunTask } from "@/lib/client/tasks";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusDot";

interface AgentDescriptor {
  type: string;
  name: string;
  description: string;
  status: string;
  capabilities: string[];
  plannedCapabilities: string[];
}

function ResultBlock({ result }: { result: unknown }) {
  if (result === null) return null;
  return (
    <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-border bg-void p-3 font-mono text-[11px] text-ink-dim">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDescriptor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ agents: AgentDescriptor[] }>("/api/agents")
      .then((r) => setAgents(r.agents))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Agents</h1>
        <p className="text-sm text-ink-faint">Specialized executors JARVIS dispatches tasks to. Try a quick action below.</p>
      </div>

      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !agents && <LoadingBlock />}

      {agents && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <Card
              key={a.type}
              title={a.name}
              action={<StatusBadge status={a.status} />}
            >
              <p className="text-sm text-ink-dim">{a.description}</p>
              {a.capabilities.length > 0 && (
                <p className="mt-2 font-mono text-[10px] text-ink-faint">Can: {a.capabilities.join(", ")}</p>
              )}
              {a.plannedCapabilities.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-ink-faint">Planned: {a.plannedCapabilities.join(", ")}</p>
              )}
              <AgentQuickAction type={a.type} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentQuickAction({ type }: { type: string }) {
  switch (type) {
    case "FILE":
      return <FileQuickAction />;
    case "DEVELOPER":
      return <DeveloperQuickAction />;
    case "RESEARCH":
      return <ResearchQuickAction />;
    case "BROWSER":
      return <BrowserQuickAction />;
    case "EMAIL":
      return <EmailQuickAction />;
    case "CONTENT":
      return <ContentQuickAction />;
    case "COMPUTER":
      return <ComputerQuickAction />;
    default:
      return null;
  }
}

function QuickActionShell({
  onSubmit,
  busy,
  children,
  result,
  error,
}: {
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  children: React.ReactNode;
  result: unknown;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        {children}
        <button
          disabled={busy}
          className="rounded border border-accent/40 bg-accent-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          {busy ? "Running..." : "Run"}
        </button>
      </div>
      {error && <p className="mt-2 font-mono text-[11px] text-signal-error">{error}</p>}
      <ResultBlock result={result} />
    </form>
  );
}

const inputClass =
  "flex-1 min-w-[10rem] rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs outline-none focus:border-accent/50";

function useQuickAction<T>(run: () => Promise<T>) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await run());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return { busy, result, error, trigger };
}

function FileQuickAction() {
  const [path, setPath] = useState(".");
  const { busy, result, error, trigger } = useQuickAction(() =>
    createAndRunTask("FILE", `List ${path}`, { op: "list", path }),
  );
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <input className={inputClass} value={path} onChange={(e) => setPath(e.target.value)} placeholder="path (e.g. .)" />
    </QuickActionShell>
  );
}

function DeveloperQuickAction() {
  const [command, setCommand] = useState("git");
  const [args, setArgs] = useState("status");
  const { busy, result, error, trigger } = useQuickAction(() =>
    createAndRunTask("DEVELOPER", `Run ${command} ${args}`, { op: "runCommand", command, args: args.split(" ").filter(Boolean) }),
  );
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <input className={inputClass} value={command} onChange={(e) => setCommand(e.target.value)} placeholder="command" />
      <input className={inputClass} value={args} onChange={(e) => setArgs(e.target.value)} placeholder="args" />
    </QuickActionShell>
  );
}

function ResearchQuickAction() {
  const [query, setQuery] = useState("");
  const { busy, result, error, trigger } = useQuickAction(() =>
    createAndRunTask("RESEARCH", `Search: ${query}`, { query }),
  );
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search query" />
    </QuickActionShell>
  );
}

function BrowserQuickAction() {
  const [url, setUrl] = useState("https://example.com");
  const { busy, result, error, trigger } = useQuickAction(() => api.post("/api/browser", { op: "navigate", url }));
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
    </QuickActionShell>
  );
}

function EmailQuickAction() {
  const { busy, result, error, trigger } = useQuickAction(() => api.post("/api/email", { op: "getAuthUrl" }));
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <span className="flex-1 text-[11px] text-ink-faint">Get the Gmail OAuth connect URL.</span>
    </QuickActionShell>
  );
}

function ContentQuickAction() {
  const [topic, setTopic] = useState("");
  const { busy, result, error, trigger } = useQuickAction(() =>
    createAndRunTask("CONTENT", `Script: ${topic}`, { op: "writeScript", topic }),
  );
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="video topic" />
    </QuickActionShell>
  );
}

function ComputerQuickAction() {
  const { busy, result, error, trigger } = useQuickAction(() => api.post("/api/computer", { name: "My Mac", platform: "darwin" }));
  return (
    <QuickActionShell onSubmit={trigger} busy={busy} result={result} error={error}>
      <span className="flex-1 text-[11px] text-ink-faint">Register a pairing request (no daemon exists yet — will show NOT_CONNECTED).</span>
    </QuickActionShell>
  );
}
