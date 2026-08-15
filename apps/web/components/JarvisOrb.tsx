export type JarvisOrbState = "idle" | "listening" | "thinking" | "executing" | "speaking" | "success" | "error";

const STATE_STYLES: Record<JarvisOrbState, { ring: string; core: string; label: string }> = {
  idle: { ring: "border-accent/30", core: "bg-accent", label: "STANDING BY" },
  listening: { ring: "border-signal-error/40", core: "bg-signal-error", label: "LISTENING" },
  thinking: { ring: "border-signal-info/40", core: "bg-signal-info", label: "THINKING" },
  executing: { ring: "border-signal-warn/50", core: "bg-signal-warn", label: "EXECUTING" },
  speaking: { ring: "border-accent/50", core: "bg-accent", label: "SPEAKING" },
  success: { ring: "border-accent/60", core: "bg-accent", label: "DONE" },
  error: { ring: "border-signal-error/40", core: "bg-signal-error", label: "ERROR" },
};

const ACTIVE_STATES: JarvisOrbState[] = ["listening", "thinking", "executing", "speaking"];

export function JarvisOrb({
  state = "idle",
  size = 120,
  showLabel = false,
  className = "",
}: {
  state?: JarvisOrbState;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const styles = STATE_STYLES[state];
  const active = ACTIVE_STATES.includes(state);
  const isSuccess = state === "success";

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className={`absolute inset-0 rounded-full border ${styles.ring} ${active ? "animate-jarvis-spin" : ""}`}
          style={{ borderStyle: "dashed" }}
        />
        <div
          className={`absolute inset-[10%] rounded-full border ${styles.ring} ${active ? "animate-jarvis-spin-reverse" : ""}`}
        />
        <div className="absolute inset-[24%] rounded-full border border-border bg-surface-raised/60 backdrop-blur-sm" />
        <div
          className={`absolute inset-[36%] rounded-full ${styles.core} ${
            isSuccess ? "animate-jarvis-success" : active ? "animate-jarvis-breathe" : "animate-jarvis-pulse"
          } opacity-90`}
          style={{ filter: "blur(0.5px)" }}
        />
        <div
          className={`absolute inset-[36%] rounded-full ${styles.core} opacity-40 blur-md`}
        />
        {active && (
          <>
            <span
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent animate-jarvis-orbit"
              style={{ ["--orbit-radius" as string]: `${size * 0.42}px` }}
            />
            <span
              className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-info animate-jarvis-orbit"
              style={{ ["--orbit-radius" as string]: `${size * 0.42}px`, animationDirection: "reverse", animationDuration: "9s" }}
            />
          </>
        )}
      </div>
      {showLabel && (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">{styles.label}</p>
      )}
    </div>
  );
}
