import { describe, expect, it } from "vitest";

import {
  createPersistenceOperation,
  createPersistenceError,
  createPersistenceFailureResult,
  createPersistenceRecordReference,
  createPersistenceSuccessResult,
  normalizePersistenceOperation,
} from ".";

describe("persistence contracts", () => {
  it("normalizes and validates persistence operation identity naming", () => {
    expect(createPersistenceOperation("workspace", "insert")).toBe(
      "workspace.insert",
    );
    expect(normalizePersistenceOperation(" Workspace.Update ")).toBe(
      "workspace.update",
    );
    expect(() => normalizePersistenceOperation("workspace_update")).toThrow(
      "Operation identity must use lowercase dot-separated segments",
    );
  });

  it("creates explicit record identity references for persistence boundaries", () => {
    const reference = createPersistenceRecordReference("project-run", "run-42");

    expect(reference).toEqual({
      recordType: "project-run",
      id: "run-42",
    });
  });

  it("creates success results that remain persistence-oriented and context-aware", () => {
    const record = createPersistenceRecordReference("workspace", "ws-1");
    const result = createPersistenceSuccessResult(
      "workspace.insert",
      { inserted: true },
      {
        requestId: "req-1",
        correlationId: "corr-1",
        record,
      },
    );

    expect(result).toEqual({
      ok: true,
      value: { inserted: true },
      requestId: "req-1",
      correlationId: "corr-1",
      operation: "workspace.insert",
      record: {
        recordType: "workspace",
        id: "ws-1",
      },
    });
  });

  it("creates failure results with persistence operation and record context", () => {
    const record = createPersistenceRecordReference("workspace", "ws-2");
    const error = createPersistenceError(
      "workspace.update",
      "conflict",
      "Version mismatch",
      {
        details: {
          expectedVersion: 3,
          actualVersion: 2,
        },
        requestId: "req-2",
        record,
      },
    );

    const failure = createPersistenceFailureResult(error, {
      correlationId: "corr-2",
    });

    expect(failure).toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "Version mismatch",
        details: {
          expectedVersion: 3,
          actualVersion: 2,
        },
        requestId: "req-2",
        correlationId: undefined,
        operation: "workspace.update",
        record: {
          recordType: "workspace",
          id: "ws-2",
        },
      },
      requestId: "req-2",
      correlationId: "corr-2",
      operation: "workspace.update",
      record: {
        recordType: "workspace",
        id: "ws-2",
      },
    });
  });
});

