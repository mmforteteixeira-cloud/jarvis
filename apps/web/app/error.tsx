"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[JARVIS UI error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-md border border-signal-error/30 bg-signal-error/5 px-6 py-8">
        <p className="font-mono text-sm uppercase tracking-widest text-signal-error">System Error</p>
        <p className="mt-2 max-w-md text-sm text-ink-dim">
          JARVIS hit an unexpected error rendering this view. Nothing was lost — try again.
        </p>
        <p className="mt-2 font-mono text-xs text-ink-faint">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
