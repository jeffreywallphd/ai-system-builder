import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createDesktopOperationalEventLogger } from "../DesktopOperationalEventLogger";

describe("createDesktopOperationalEventLogger", () => {
  it("emits structured events to console and file", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "ai-loom-desktop-operational-logger-"));
    const infoLogs: string[] = [];
    const warnLogs: string[] = [];
    const errorLogs: string[] = [];
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    try {
      console.info = (message?: unknown) => {
        infoLogs.push(String(message ?? ""));
      };
      console.warn = (message?: unknown) => {
        warnLogs.push(String(message ?? ""));
      };
      console.error = (message?: unknown) => {
        errorLogs.push(String(message ?? ""));
      };

      const logger = createDesktopOperationalEventLogger({
        logsDirectory: tempRoot,
        now: () => new Date("2026-04-12T09:00:00.000Z"),
      });

      logger.info({ event: "runtime.start", requestId: "req-1" });
      logger.warn({ event: "runtime.warn", requestId: "req-2" });
      logger.error({ event: "runtime.error", requestId: "req-3" });

      expect(infoLogs[0]).toContain('"event":"runtime.start"');
      expect(warnLogs[0]).toContain('"event":"runtime.warn"');
      expect(errorLogs[0]).toContain('"event":"runtime.error"');

      const logPath = path.join(tempRoot, "desktop-operational.log");
      const fileContent = readFileSync(logPath, "utf8");
      expect(fileContent).toContain('"event":"runtime.start"');
      expect(fileContent).toContain('"event":"runtime.warn"');
      expect(fileContent).toContain('"event":"runtime.error"');
      expect(fileContent).toContain('"emittedAt":"2026-04-12T09:00:00.000Z"');
    } finally {
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
