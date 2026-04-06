import { describe, expect, it } from "bun:test";
import { SafeSqliteRepositoryBase } from "../SafeSqliteRepositoryBase";
import type {
  IPersistenceDiagnosticsLogger,
  PersistenceDiagnosticsLogEvent,
} from "../../../logging/PersistenceDiagnosticsLogger";
import { PersistenceFailure } from "../../PersistenceFailure";

class RecordingPersistenceLogger implements IPersistenceDiagnosticsLogger {
  public readonly infoEvents: PersistenceDiagnosticsLogEvent[] = [];
  public readonly warnEvents: PersistenceDiagnosticsLogEvent[] = [];
  public readonly errorEvents: PersistenceDiagnosticsLogEvent[] = [];

  public info(event: PersistenceDiagnosticsLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: PersistenceDiagnosticsLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: PersistenceDiagnosticsLogEvent): void {
    this.errorEvents.push(event);
  }
}

class TestRepositoryBase extends SafeSqliteRepositoryBase {
  public constructor(logger?: IPersistenceDiagnosticsLogger) {
    super("Test repository", {
      diagnosticsLogger: logger,
    });
  }

  public buildPaging(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    return this.buildPagingClause(limit, offset);
  }

  public runMutation(
    operation: string,
    mutation: () => { readonly changes: number },
    diagnostics?: Readonly<Record<string, unknown>>,
  ): { readonly changes: number } {
    return this.executeMutation(operation, mutation, diagnostics);
  }

  public resolveTimestamp(candidate?: string): string {
    return this.resolveMutationTimestamp(candidate);
  }
}

describe("SafeSqliteRepositoryBase", () => {
  it("exposes shared paging behavior", () => {
    const base = new TestRepositoryBase();
    expect(base.buildPaging(5, 2)).toEqual({
      sql: "LIMIT ? OFFSET ?",
      params: [5, 2],
    });
  });

  it("translates mutation errors into persistence-safe failures", () => {
    const logger = new RecordingPersistenceLogger();
    const base = new TestRepositoryBase(logger);

    expect(() => base.runMutation("save record", () => {
      throw new Error("constraint violation");
    }, {
      prompt: "draw a dragon in watercolor",
      databasePath: "C:\\Users\\jeffr\\secrets\\db.sqlite",
    })).toThrow("Test repository persistence failed to save record.");

    try {
      base.runMutation("save record", () => {
        throw new Error("expectedRevision mismatch");
      });
      throw new Error("Expected runMutation to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceFailure);
      const failure = error as PersistenceFailure;
      expect(failure.code).toBe("persistence-concurrency-conflict");
      expect(failure.message).not.toContain("expectedRevision mismatch");
    }

    expect(logger.errorEvents).toHaveLength(2);
    const serialized = JSON.stringify(logger.errorEvents[0]);
    expect(serialized).not.toContain("draw a dragon in watercolor");
    expect(serialized).not.toContain("C:\\\\Users\\\\jeffr\\\\secrets\\\\db.sqlite");
    expect(serialized).toContain("[REDACTED]");
  });

  it("resolves timestamps from provided candidates or current time", () => {
    const base = new TestRepositoryBase();
    expect(base.resolveTimestamp("2026-04-06T12:00:00.000Z")).toBe("2026-04-06T12:00:00.000Z");
    expect(base.resolveTimestamp("")).not.toBe("");
  });
});
