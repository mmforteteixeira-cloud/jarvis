"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";

interface SystemStatus {
  status: string;
  aiProvider: { name: string; mode: "REAL" | "DEMO"; model: string };
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    api.get<SystemStatus>("/api/system/status").then(setStatus).catch(() => null);
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Settings</h1>
        <p className="text-sm text-ink-faint">JARVIS's runtime configuration, read from environment variables.</p>
      </div>

      <Card title="AI Provider">
        <p className="text-sm text-ink-dim">
          Provider: <span className="text-ink">{status?.aiProvider.name ?? "..."}</span>
        </p>
        <p className="text-sm text-ink-dim">
          Model: <span className="text-ink">{status?.aiProvider.model ?? "..."}</span>
        </p>
        <p className="text-sm text-ink-dim">
          Mode: <span className={status?.aiProvider.mode === "REAL" ? "text-accent" : "text-signal-warn"}>{status?.aiProvider.mode ?? "..."}</span>
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Set <code className="text-ink">AI_API_KEY</code> (Anthropic) or <code className="text-ink">OPENAI_API_KEY</code> in your{" "}
          <code className="text-ink">.env</code> file, then restart the app, to enable real reasoning.
        </p>
      </Card>

      <Card title="Persona">
        <p className="text-sm text-ink-dim">
          Direct, proactive, honest about what isn't wired up yet. Defined in{" "}
          <code className="text-ink">packages/core/src/persona.ts</code> — edit it to change how JARVIS talks.
        </p>
      </Card>

      <Card title="Database">
        <p className="text-sm text-ink-dim">
          Local SQLite file at <code className="text-ink">DATABASE_URL</code> (default{" "}
          <code className="text-ink">file:./data/jarvis.db</code>). See ARCHITECTURE.md for the Postgres/Supabase
          migration path.
        </p>
      </Card>

      <Card title="Danger zone">
        <p className="text-sm text-ink-faint">
          There is currently no destructive action exposed from the UI. HIGH_RISK operations (deleting files outside
          the workspace, irreversible changes) always require explicit approval — see SECURITY.md.
        </p>
      </Card>
    </div>
  );
}
