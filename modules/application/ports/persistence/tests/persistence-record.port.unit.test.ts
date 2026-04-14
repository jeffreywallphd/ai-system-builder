import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createPersistenceOperationForRecord,
  createPersistenceRecordReference,
  type PersistenceOperation,
  type PersistenceRecordReference,
} from "../../../../contracts/persistence";

import type {
  DeletePersistenceRecordRequest,
  LoadPersistenceRecordRequest,
  PersistenceRecordOperationRequest,
  PersistenceRecordPort,
  SavePersistenceRecordRequest,
} from "../persistence-record.port";

describe("PersistenceRecordPort", () => {
  it("keeps a thin seam with load/save/delete record operations", () => {
    expectTypeOf<keyof PersistenceRecordPort>().toEqualTypeOf<
      "loadRecord" | "saveRecord" | "deleteRecord"
    >();
  });

  it("requires operation identity and record reference on all request types", () => {
    expectTypeOf<PersistenceRecordOperationRequest>().toExtend<{
      operation: PersistenceOperation;
      record: PersistenceRecordReference;
    }>();

    expectTypeOf<LoadPersistenceRecordRequest>().toExtend<{
      operation: PersistenceOperation;
      record: PersistenceRecordReference;
    }>();

    expectTypeOf<SavePersistenceRecordRequest<{ name: string }>>().toExtend<{
      operation: PersistenceOperation;
      record: PersistenceRecordReference;
      value: { name: string };
    }>();

    expectTypeOf<DeletePersistenceRecordRequest>().toExtend<{
      operation: PersistenceOperation;
      record: PersistenceRecordReference;
    }>();
  });

  it("passes operation-aware record requests through the port contract", async () => {
    const operation = createPersistenceOperationForRecord("project", "load");
    const record = createPersistenceRecordReference("project", "project-42");

    const request: LoadPersistenceRecordRequest = {
      operation,
      record,
      requestId: "req-42",
      correlationId: "corr-42",
    };

    const loadRecord = vi
      .fn<PersistenceRecordPort["loadRecord"]>()
      .mockResolvedValue({
        ok: true,
        operation,
        record,
        value: {
          id: "project-42",
          name: "Project 42",
        },
        requestId: request.requestId,
        correlationId: request.correlationId,
      });

    const port: PersistenceRecordPort = {
      loadRecord,
      saveRecord: vi.fn(),
      deleteRecord: vi.fn(),
    };

    const result = await port.loadRecord(request);

    expect(loadRecord).toHaveBeenCalledWith(request);
    expect(result.ok).toBe(true);
    expect(result.operation).toBe("project.load");
    expect(result.record).toEqual({
      recordType: "project",
      id: "project-42",
    });
  });

  it("keeps requests record-oriented rather than storage-key oriented", () => {
    const request: DeletePersistenceRecordRequest = {
      operation: createPersistenceOperationForRecord("project", "delete"),
      record: createPersistenceRecordReference("project", "project-42"),
    };

    expect("key" in request).toBe(false);
    expect(request.record).toEqual({
      recordType: "project",
      id: "project-42",
    });
  });
});
