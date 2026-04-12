import fs from "node:fs";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

export interface DesktopOperationalEventLogger {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}

export interface DesktopOperationalEventLoggerOptions {
  readonly logsDirectory: string;
  readonly fileName?: string;
  readonly now?: () => Date;
}

const DefaultFileName = "desktop-operational.log";

export function createDesktopOperationalEventLogger(
  options: DesktopOperationalEventLoggerOptions,
): DesktopOperationalEventLogger {
  const filePath = path.join(options.logsDirectory, options.fileName ?? DefaultFileName);
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    info: (event) => writeLogEvent("info", event),
    warn: (event) => writeLogEvent("warn", event),
    error: (event) => writeLogEvent("error", event),
  });

  function writeLogEvent(level: LogLevel, event: Readonly<Record<string, unknown>>): void {
    const payload = Object.freeze({
      level,
      emittedAt: now().toISOString(),
      ...event,
    });

    const serialized = `${safeStringify(payload)}\n`;
    writeToConsole(level, serialized.trim());
    appendToFile(serialized);
  }

  function appendToFile(serialized: string): void {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.appendFileSync(filePath, serialized, "utf8");
    } catch {
      // Logging is best-effort and must not interrupt host/runtime operations.
    }
  }
}

function writeToConsole(level: LogLevel, serialized: string): void {
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}

function safeStringify(payload: Readonly<Record<string, unknown>>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      level: payload.level,
      emittedAt: payload.emittedAt,
      event: "desktop-operational-log.serialization-failure",
    });
  }
}
