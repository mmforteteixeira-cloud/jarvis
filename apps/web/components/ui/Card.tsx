import type { ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-border bg-surface/80 backdrop-blur-sm ${className}`}
    >
      {title && (
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink-dim">{title}</h2>
          {action}
        </header>
      )}
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </section>
  );
}
