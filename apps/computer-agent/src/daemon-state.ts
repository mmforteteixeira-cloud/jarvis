export type DaemonState = "CONNECTING" | "ONLINE" | "BUSY" | "ERROR" | "OFFLINE";

interface StateSnapshot {
  state: DaemonState;
  lastError: string | null;
  lastCommandAt: string | null;
  commandsExecuted: number;
  startedAt: string;
}

const snapshot: StateSnapshot = {
  state: "CONNECTING",
  lastError: null,
  lastCommandAt: null,
  commandsExecuted: 0,
  startedAt: new Date().toISOString(),
};

/** Single source of truth for "what is this daemon doing right now",
 * read by both the heartbeat (to report BUSY accurately) and the local
 * diagnostic HTTP server (GET /status). */
export const daemonState = {
  get(): Readonly<StateSnapshot> {
    return { ...snapshot };
  },
  setState(state: DaemonState, error?: string) {
    snapshot.state = state;
    if (error) snapshot.lastError = error;
  },
  recordCommand() {
    snapshot.lastCommandAt = new Date().toISOString();
    snapshot.commandsExecuted += 1;
  },
};
