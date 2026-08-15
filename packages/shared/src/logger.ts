/**
 * Minimal structured logger shared across all JARVIS packages.
 * Kept dependency-free so every package (including edge-safe ones) can use it.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentThreshold(): number {
  const envLevel = (typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined) as
    | LogLevel
    | undefined;
  return LEVEL_ORDER[envLevel ?? "info"] ?? LEVEL_ORDER.info;
}

export class Logger {
  constructor(private readonly scope: string) {}

  private log(level: LogLevel, message: string, fields?: LogFields) {
    if (LEVEL_ORDER[level] < currentThreshold()) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      scope: this.scope,
      message,
      ...fields,
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(message: string, fields?: LogFields) {
    this.log("debug", message, fields);
  }
  info(message: string, fields?: LogFields) {
    this.log("info", message, fields);
  }
  warn(message: string, fields?: LogFields) {
    this.log("warn", message, fields);
  }
  error(message: string, fields?: LogFields) {
    this.log("error", message, fields);
  }

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`);
  }
}

export function createLogger(scope: string): Logger {
  return new Logger(scope);
}
