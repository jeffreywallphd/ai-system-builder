import { describe, expect, it } from "bun:test";
import { translatePersistenceError } from "../PersistenceErrorTranslation";
import { PersistenceFailure, PersistenceFailureCodes } from "../PersistenceFailure";

describe("PersistenceErrorTranslation", () => {
  it("maps sqlite constraint failures to conflict-safe persistence errors", () => {
    const raw = Object.assign(new Error("UNIQUE constraint failed: run_records.run_id"), {
      code: "SQLITE_CONSTRAINT_UNIQUE",
    });

    const translated = translatePersistenceError({
      repository: "Platform",
      operation: "save run",
      error: raw,
    });

    expect(translated).toBeInstanceOf(PersistenceFailure);
    expect(translated.code).toBe(PersistenceFailureCodes.conflict);
    expect(translated.message).toBe("Platform persistence failed to save run.");
  });

  it("redacts sensitive diagnostics before attaching failure metadata", () => {
    const translated = translatePersistenceError({
      repository: "Platform",
      operation: "save run",
      error: new Error("constraint"),
      diagnostics: {
        prompt: "secret scene prompt",
        token: "Bearer abc123",
        databasePath: "C:\\Users\\jeffr\\private\\server.sqlite",
      },
    });

    const serialized = JSON.stringify(translated.diagnostics);
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("secret scene prompt");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("C:\\\\Users\\\\jeffr\\\\private\\\\server.sqlite");
  });

  it("maps optimistic concurrency failures into stable concurrency conflict codes", () => {
    const translated = translatePersistenceError({
      repository: "Node trust",
      operation: "save node",
      error: new Error("Node expectedRevision '4' did not match persisted revision '3'."),
    });

    expect(translated.code).toBe(PersistenceFailureCodes.concurrencyConflict);
    expect(translated.retryable).toBeFalse();
  });

  it("marks backend lock or busy failures as retryable unavailable errors", () => {
    const raw = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });

    const translated = translatePersistenceError({
      repository: "Workspace",
      operation: "save invitation",
      error: raw,
    });

    expect(translated.code).toBe(PersistenceFailureCodes.unavailable);
    expect(translated.retryable).toBeTrue();
  });

  it("returns persistence failures unchanged to preserve stable semantics", () => {
    const input = new PersistenceFailure(
      PersistenceFailureCodes.notFound,
      "Workspace persistence failed to load invitation.",
    );

    const translated = translatePersistenceError({
      repository: "Workspace",
      operation: "load invitation",
      error: input,
    });

    expect(translated).toBe(input);
  });
});
