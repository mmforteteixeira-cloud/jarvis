"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusDot";

interface Integration {
  id: string;
  category: string;
  name: string;
  status: string;
  mode: "REAL" | "DEMO" | "NOT_CONFIGURED";
  detail: string;
  configuredEnvVars: string[];
  missingEnvVars: string[];
}

const CATEGORY_ORDER: string[] = ["AI", "VOICE", "SEARCH", "BROWSER", "GITHUB", "EMAIL", "TIKTOK", "COMPUTER", "DATABASE"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ integrations: Integration[] }>("/api/integrations")
      .then((r) => setIntegrations(r.integrations))
      .catch((e) => setError(e.message));
  }, []);

  const grouped = integrations
    ? [...integrations].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg text-ink">Integrations</h1>
        <p className="text-sm text-ink-faint">
          What's really connected vs. what needs an API key in <code className="text-ink">.env</code>. Never faked.
        </p>
      </div>

      {error && <p className="font-mono text-xs text-signal-error">{error}</p>}
      {!error && !grouped && <LoadingBlock />}

      {grouped && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {grouped.map((integration) => (
            <Card key={integration.id} title={integration.name} action={<StatusBadge status={integration.status} />}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">{integration.category}</p>
              <p className="mt-2 text-sm text-ink-dim">{integration.detail}</p>
              <p className="mt-2 font-mono text-[10px] text-ink-faint">
                Mode: <span className={integration.mode === "REAL" ? "text-accent" : "text-signal-warn"}>{integration.mode}</span>
              </p>
              {integration.missingEnvVars.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-signal-warn">
                  Needs: {integration.missingEnvVars.join(", ")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
