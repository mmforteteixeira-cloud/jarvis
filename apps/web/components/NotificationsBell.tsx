"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

const SEVERITY_DOT: Record<Notification["severity"], string> = {
  info: "bg-signal-info",
  success: "bg-accent",
  warning: "bg-signal-warn",
  error: "bg-signal-error",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function load() {
    api
      .get<{ notifications: Notification[] }>("/api/notifications")
      .then((r) => setNotifications(r.notifications))
      .catch(() => {
        // best-effort — a failed poll just tries again next interval
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      load();
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md border border-border p-1.5 text-ink-dim hover:text-ink"
        aria-label="Notifications"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-error px-1 font-mono text-[9px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-80 w-80 overflow-y-auto rounded-md border border-border bg-surface-raised shadow-xl animate-jarvis-fade-in-up">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-xs text-ink-faint">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 ${
                  n.read ? "opacity-60" : "hover:bg-surface"
                }`}
              >
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{n.title}</span>
                  <span className="block truncate text-xs text-ink-dim">{n.message}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">{relativeTime(n.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
