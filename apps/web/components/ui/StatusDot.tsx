const COLORS: Record<string, string> = {
  ONLINE: "bg-accent shadow-glow",
  IDLE: "bg-accent",
  WORKING: "bg-signal-info",
  BUSY: "bg-signal-info",
  ERROR: "bg-signal-error",
  FAILED: "bg-signal-error",
  NOT_CONNECTED: "bg-ink-faint",
  NOT_CONFIGURED: "bg-ink-faint",
  OFFLINE: "bg-ink-faint",
  WAITING_APPROVAL: "bg-signal-warn",
  CONFIGURATION_REQUIRED: "bg-signal-warn",
  CONNECTED: "bg-accent",
  COMPLETED: "bg-accent",
};

export function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const color = COLORS[status] ?? "bg-ink-faint";
  return (
    <span className="relative flex h-2 w-2">
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const isPositive = ["ONLINE", "IDLE", "CONNECTED", "COMPLETED", "APPROVED"].includes(status);
  const isNegative = ["ERROR", "FAILED", "OFFLINE", "DENIED"].includes(status);
  const isWarn = ["WAITING_APPROVAL", "CONFIGURATION_REQUIRED", "PENDING", "BUSY"].includes(status);
  const tone = isNegative ? "text-signal-error" : isWarn ? "text-signal-warn" : isPositive ? "text-accent" : "text-ink-faint";
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide ${tone}`}>
      <StatusDot status={status} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
