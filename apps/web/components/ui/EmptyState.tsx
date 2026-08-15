import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center">
      <p className="font-mono text-sm text-ink-dim">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-faint">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent ${className}`}
      aria-label="Loading"
    />
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-ink-faint">
      <Spinner />
      <span className="font-mono text-xs">{label}</span>
    </div>
  );
}
