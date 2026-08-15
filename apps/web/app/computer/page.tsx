"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { createAndRunTask } from "@/lib/client/tasks";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusDot";

interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  architecture: string;
  agentVersion: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
}

interface CommandInfo {
  id: string;
  type: string;
  state: string;
  riskLevel: string;
  result: unknown;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function duration(command: CommandInfo): string {
  if (!command.startedAt || !command.completedAt) return "—";
  const ms = new Date(command.completedAt).getTime() - new Date(command.startedAt).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ComputerPage() {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [commands, setCommands] = useState<CommandInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<{ devices: DeviceInfo[]; commands: CommandInfo[] }>("/api/computer")
      .then((r) => {
        setDevices(r.devices);
        setCommands(r.commands);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const primaryDevice = devices?.find((d) => d.status === "ONLINE" || d.status === "BUSY") ?? devices?.[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Computer Agent</h1>
        <p className="text-sm text-ink-faint">
          Controls a paired local device via the <code className="text-ink">jarvis-computer</code> daemon. Never fakes a
          result — offline means offline.
        </p>
      </div>

      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}

      <Card title="Device">
        {!error && devices === null && <LoadingBlock />}
        {devices && devices.length === 0 && (
          <EmptyState
            title="No device has ever registered"
            description="Start the daemon: cd apps/computer-agent && pnpm dev (after configuring .env)."
          />
        )}
        {primaryDevice && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">{primaryDevice.name || "Unnamed device"}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-faint">
                {primaryDevice.platform || "unknown platform"} · {primaryDevice.architecture || "unknown arch"}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={primaryDevice.status} />
              <p className="mt-1 font-mono text-[10px] text-ink-faint">Version: {primaryDevice.agentVersion || "—"}</p>
              <p className="font-mono text-[10px] text-ink-faint">Last heartbeat: {relativeTime(primaryDevice.lastSeenAt)}</p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Available Actions">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OpenApplicationAction onDone={load} />
          <OpenUrlAction onDone={load} />
          <ScreenshotAction onDone={load} />
          <ListFilesAction onDone={load} />
          <ReadFileAction onDone={load} />
          <WriteFileAction onDone={load} />
          <RunCommandAction onDone={load} />
        </div>
      </Card>

      <Card title="Recent Commands">
        {!error && commands === null && <LoadingBlock />}
        {commands && commands.length === 0 && <EmptyState title="No commands sent yet" />}
        {commands && commands.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-ink-faint">
                  <th className="py-2 pr-4">Command</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {commands.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 align-top">
                    <td className="py-2 pr-4 text-ink-dim">{c.type}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={c.state} />
                    </td>
                    <td className="py-2 pr-4 text-ink-faint">{duration(c)}</td>
                    <td className="py-2 max-w-xs truncate text-ink-faint" title={c.error ?? JSON.stringify(c.result ?? "")}>
                      {c.error ?? (c.result ? JSON.stringify(c.result).slice(0, 80) : "—")}
                    </td>
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

function ActionCard({
  label,
  children,
  onSubmit,
  busy,
  error,
  result,
}: {
  label: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  error: string | null;
  result: unknown;
}) {
  const screenshotBase64 =
    result && typeof result === "object" && "base64" in (result as Record<string, unknown>)
      ? (result as { base64: string }).base64
      : null;

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-border p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">{label}</p>
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
      {screenshotBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${screenshotBase64}`} alt="Screenshot" className="mt-2 max-h-40 rounded border border-border" />
      )}
      {result != null && !screenshotBase64 && (
        <pre className="mt-2 max-h-32 overflow-auto rounded border border-border bg-void p-2 font-mono text-[10px] text-ink-dim">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
}

const inputClass = "flex-1 min-w-[8rem] rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs outline-none focus:border-accent/50";

function useComputerAction(onDone: () => void, type: string, buildPayload: () => Record<string, unknown>, description: string) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const task = (await createAndRunTask("COMPUTER", description, { type, payload: buildPayload() })) as {
        result?: unknown;
        error?: string;
        state: string;
      };
      if (task.error) setError(task.error);
      setResult(task.result ?? null);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return { busy, result, error, trigger };
}

function OpenApplicationAction({ onDone }: { onDone: () => void }) {
  const [application, setApplication] = useState("Safari");
  const { busy, result, error, trigger } = useComputerAction(onDone, "OPEN_APPLICATION", () => ({ application }), `Open ${application}`);
  return (
    <ActionCard label="Open Application" onSubmit={trigger} busy={busy} error={error} result={result}>
      <select value={application} onChange={(e) => setApplication(e.target.value)} className={inputClass}>
        {["Safari", "Terminal", "Visual Studio Code", "Finder", "Notes", "Calculator", "Google Chrome", "Firefox"].map((app) => (
          <option key={app} value={app}>
            {app}
          </option>
        ))}
      </select>
    </ActionCard>
  );
}

function OpenUrlAction({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("https://example.com");
  const { busy, result, error, trigger } = useComputerAction(onDone, "OPEN_URL", () => ({ url }), `Open URL ${url}`);
  return (
    <ActionCard label="Open URL" onSubmit={trigger} busy={busy} error={error} result={result}>
      <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
    </ActionCard>
  );
}

function ScreenshotAction({ onDone }: { onDone: () => void }) {
  const { busy, result, error, trigger } = useComputerAction(onDone, "SCREENSHOT", () => ({}), "Take a screenshot");
  return (
    <ActionCard label="Screenshot" onSubmit={trigger} busy={busy} error={error} result={result}>
      <span className="flex-1 text-[11px] text-ink-faint">Captures the screen, deletes the temp file immediately.</span>
    </ActionCard>
  );
}

function ListFilesAction({ onDone }: { onDone: () => void }) {
  const [path, setPath] = useState(".");
  const { busy, result, error, trigger } = useComputerAction(onDone, "LIST_DIRECTORY", () => ({ path }), `List ${path}`);
  return (
    <ActionCard label="List Files" onSubmit={trigger} busy={busy} error={error} result={result}>
      <input className={inputClass} value={path} onChange={(e) => setPath(e.target.value)} placeholder="." />
    </ActionCard>
  );
}

function ReadFileAction({ onDone }: { onDone: () => void }) {
  const [path, setPath] = useState("");
  const { busy, result, error, trigger } = useComputerAction(onDone, "READ_FILE", () => ({ path }), `Read ${path}`);
  return (
    <ActionCard label="Read File" onSubmit={trigger} busy={busy} error={error} result={result}>
      <input className={inputClass} value={path} onChange={(e) => setPath(e.target.value)} placeholder="notes.txt" />
    </ActionCard>
  );
}

function WriteFileAction({ onDone }: { onDone: () => void }) {
  const [path, setPath] = useState("hello.txt");
  const [content, setContent] = useState("Hello from JARVIS");
  const { busy, result, error, trigger } = useComputerAction(onDone, "WRITE_FILE", () => ({ path, content }), `Write ${path}`);
  return (
    <ActionCard label="Write File" onSubmit={trigger} busy={busy} error={error} result={result}>
      <input className={inputClass} value={path} onChange={(e) => setPath(e.target.value)} placeholder="path" />
      <input className={inputClass} value={content} onChange={(e) => setContent(e.target.value)} placeholder="content" />
    </ActionCard>
  );
}

function RunCommandAction({ onDone }: { onDone: () => void }) {
  const [command, setCommand] = useState("pwd");
  const [args, setArgs] = useState("");
  const { busy, result, error, trigger } = useComputerAction(
    onDone,
    "RUN_COMMAND",
    () => ({ command, args: args.split(" ").filter(Boolean) }),
    `Run ${command}`,
  );
  return (
    <ActionCard label="Run Command" onSubmit={trigger} busy={busy} error={error} result={result}>
      <input className={inputClass} value={command} onChange={(e) => setCommand(e.target.value)} placeholder="command" />
      <input className={inputClass} value={args} onChange={(e) => setArgs(e.target.value)} placeholder="args" />
    </ActionCard>
  );
}
