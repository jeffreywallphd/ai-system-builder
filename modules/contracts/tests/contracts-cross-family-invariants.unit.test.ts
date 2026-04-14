import { describe, expect, it } from "vitest";

import { createApiRequest } from "../api";
import {
  createIpcChannel,
  createIpcRequest,
  parseIpcChannelValue,
} from "../ipc";
import {
  LOG_LEVELS,
  LOG_VERBOSITIES,
  resolveLogVerbosity,
} from "../logging";
import {
  createPersistenceOperationForRecord,
  createPersistenceRecordReference,
  createPersistenceSuccessResult,
  normalizePersistenceOperation,
} from "../persistence";
import {
  createRuntimeExecutionDiagnostic,
  mapRuntimeDiagnosticToStructuredLogEvent,
  normalizeRuntimeOperation,
} from "../runtime";
import {
  createStoreArtifactRequest,
  normalizeStorageArtifactKey,
} from "../storage";
import {
  createTransportOperation,
  createTransportRequest,
  normalizeTransportOperation,
} from "../transport";

describe("contracts cross-family invariants", () => {
  it("keeps operation identity normalization aligned across transport, runtime, and persistence", () => {
    const rawOperation = " Workspace.Create ";

    const transportOperation = normalizeTransportOperation(rawOperation);
    const runtimeOperation = normalizeRuntimeOperation(rawOperation);
    const persistenceOperation = normalizePersistenceOperation(rawOperation);

    expect(transportOperation).toBe("workspace.create");
    expect(runtimeOperation).toBe("workspace.create");
    expect(persistenceOperation).toBe("workspace.create");
    expect(createTransportOperation("workspace", "create")).toBe(transportOperation);
  });

  it("keeps api and ipc request envelopes as transport specializations, not parallel systems", () => {
    const operation = createTransportOperation("workspace", "create");
    const payload = { name: "alpha" };
    const options = {
      requestId: "req-801",
      correlationId: "corr-801",
      metadata: { source: "contracts-invariant-test" },
    };

    const transportRequest = createTransportRequest(operation, payload, options);
    const apiRequest = createApiRequest(operation, payload, options);
    const ipcChannel = createIpcChannel(operation, "request");
    const ipcRequest = createIpcRequest(ipcChannel, payload, options);
    const parsedChannel = parseIpcChannelValue(ipcChannel.value);

    expect(apiRequest).toEqual(transportRequest);
    expect(ipcRequest).toEqual({
      ...transportRequest,
      channel: "ipc.workspace.create.request",
    });
    expect(parsedChannel).toEqual({
      operation,
      kind: "request",
      value: "ipc.workspace.create.request",
    });
  });

  it("keeps runtime diagnostics as runtime.* events that map directly into shared logging contracts", () => {
    const runtimeDiagnostic = createRuntimeExecutionDiagnostic({
      timestamp: "2026-04-14T12:00:00.000Z",
      level: "info",
      verbosity: resolveLogVerbosity(" VERBOSE "),
      event: " Runtime.Execution.Completed ",
      message: "Runtime execution completed",
      component: "runtime-adapter",
      operation: "workspace.create",
      outcome: "success",
    });

    const structuredLogEvent = mapRuntimeDiagnosticToStructuredLogEvent(
      runtimeDiagnostic,
      {
        host: "server",
        requestId: "req-802",
        correlationId: "corr-802",
      },
    );

    expect(runtimeDiagnostic.event).toBe("runtime.execution.completed");
    expect(LOG_LEVELS).toContain(structuredLogEvent.level);
    expect(LOG_VERBOSITIES).toContain(structuredLogEvent.verbosity);
    expect(structuredLogEvent).toMatchObject({
      event: "runtime.execution.completed",
      operation: "workspace.create",
      requestId: "req-802",
      correlationId: "corr-802",
      host: "server",
    });
  });

  it("keeps persistence record semantics distinct from storage key semantics", () => {
    const persistenceOperation = createPersistenceOperationForRecord(
      "workspace",
      "update",
    );
    const record = createPersistenceRecordReference("workspace", "ws-42");
    const persistenceResult = createPersistenceSuccessResult(
      persistenceOperation,
      {
        updated: true,
      },
      {
        record,
      },
    );

    const storageKey = normalizeStorageArtifactKey(
      " workspace/ws-42/snapshots/state.json ",
    );
    const storageRequest = createStoreArtifactRequest(
      new Uint8Array([1, 2, 3]),
      {
        descriptor: {
          key: storageKey,
        },
      },
    );

    expect(persistenceResult).toMatchObject({
      operation: "workspace.update",
      record: {
        recordType: "workspace",
        id: "ws-42",
      },
    });
    expect("descriptor" in persistenceResult).toBe(false);
    expect(storageRequest).toMatchObject({
      descriptor: {
        key: "workspace/ws-42/snapshots/state.json",
      },
    });
    expect("operation" in storageRequest).toBe(false);
    expect("record" in storageRequest).toBe(false);
  });
});
