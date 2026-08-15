"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/projects", label: "Projects", icon: "▣" },
  { href: "/tasks", label: "Tasks", icon: "☰" },
  { href: "/agents", label: "Agents", icon: "◈" },
  { href: "/computer", label: "Computer", icon: "▢" },
  { href: "/activity", label: "Activity", icon: "≋" },
  { href: "/memory", label: "Memory", icon: "◐" },
  { href: "/integrations", label: "Integrations", icon: "⬡" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface/60">
      <div className="flex items-center gap-2 border-b border-border px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-accent-soft font-mono text-sm text-accent">
          J
        </span>
        <div>
          <p className="font-mono text-sm font-semibold tracking-widest text-ink">JARVIS</p>
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">personal ai</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent-soft text-accent border border-accent/30"
                  : "text-ink-dim hover:bg-surface-raised hover:text-ink border border-transparent"
              }`}
            >
              <span className="w-4 text-center font-mono text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4 text-[10px] text-ink-faint font-mono">
        <p>JARVIS v0.2.0</p>
        <p>local · zero-cost mode</p>
      </div>
    </aside>
  );
}
