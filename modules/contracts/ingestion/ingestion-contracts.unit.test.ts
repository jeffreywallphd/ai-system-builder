import { describe, expect, it } from "vitest";

import { createContractError } from "../shared";
import {
  INGESTION_SOURCE_KINDS,
  createRegisterStagedDataFailureResult,
  createRegisterStagedDataRequest,
  createRegisterStagedDataSuccessResult,
  createStagedDataDescriptorFromStorageObjectDescriptor,
  normalizeIngestionSourceKind,
} from ".";

describe("ingestion contracts", () => {
  it("normalizes and constrains ingestion source kinds", () => {
    expect(INGESTION_SOURCE_KINDS).toEqual([
      "upload",
      "scrape",
      "generated",
      "api",
      "runtime",
    ]);
    expect(normalizeIngestionSourceKind(" Upload ")).toBe("upload");
    expect(() => normalizeIngestionSourceKind("other")).toThrow(
      'Ingestion source kind must be one of upload, scrape, generated, api, runtime. Received "other".',
    );
  });

  it("creates staged-data registration requests with normalized descriptor fields", () => {
    const request = createRegisterStagedDataRequest(new Uint8Array([9, 8]), {
      descriptor: {
        storageKey: " staging/object-8 ",
        sourceKind: " generated ",
        mediaType: "application/json",
        originalName: " generated-output.json ",
      },
      overwrite: true,
      requestId: "req-880",
      correlationId: "corr-880",
    });

    expect(request).toEqual({
      descriptor: {
        storageKey: "staging/object-8",
        sourceKind: "generated",
        mediaType: "application/json",
        originalName: "generated-output.json",
      },
      content: new Uint8Array([9, 8]),
      overwrite: true,
      requestId: "req-880",
      correlationId: "corr-880",
    });
  });

  it("creates staged-data descriptors from storage descriptors for specialized intake paths", () => {
    const descriptor = createStagedDataDescriptorFromStorageObjectDescriptor(
      {
        key: " uploads/images/kitten.png ",
        mediaType: "image/png",
        sizeBytes: 42,
      },
      {
        sourceKind: "upload",
        originalName: " kitten.png ",
      },
    );

    expect(descriptor).toEqual({
      storageKey: "uploads/images/kitten.png",
      sourceKind: "upload",
      mediaType: "image/png",
      sizeBytes: 42,
      originalName: "kitten.png",
    });
  });

  it("creates registration failure and success results using shared contract result semantics", () => {
    const success = createRegisterStagedDataSuccessResult({
      storageKey: " staging/object-9 ",
      sourceKind: "api",
      mediaType: "application/json",
      createdAt: " 2026-04-16T00:00:00.000Z ",
    });

    expect(success).toEqual({
      ok: true,
      value: {
        storageKey: "staging/object-9",
        sourceKind: "api",
        mediaType: "application/json",
        createdAt: "2026-04-16T00:00:00.000Z",
      },
      requestId: undefined,
      correlationId: undefined,
    });

    const failure = createRegisterStagedDataFailureResult(
      createContractError("unavailable", "Ingestion adapter unavailable", {
        details: {
          sourceKind: "api",
        },
      }),
      {
        requestId: "req-881",
      },
    );

    expect(failure).toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "Ingestion adapter unavailable",
        details: {
          sourceKind: "api",
        },
        requestId: undefined,
        correlationId: undefined,
      },
      requestId: "req-881",
      correlationId: undefined,
    });
  });
});
