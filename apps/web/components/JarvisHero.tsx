"use client";

import { useAppUI } from "./providers";
import { JarvisOrb } from "./JarvisOrb";

export function JarvisHero() {
  const { jarvisState } = useAppUI();

  return (
    <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-border bg-surface/60 py-8 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 animate-jarvis-glow" />
      <JarvisOrb state={jarvisState} size={96} showLabel />
      <div className="text-center">
        <h1 className="font-mono text-lg tracking-[0.3em] text-ink">JARVIS</h1>
        <p className="text-xs text-ink-faint">Just A Rather Very Intelligent System</p>
      </div>
    </div>
  );
}
