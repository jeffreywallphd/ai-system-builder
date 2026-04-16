import { describe, expect, it } from "vitest";

import { createContractError } from "../shared";
import {
  createDeleteArtifactFailureResult,
  createDeleteArtifactRequest,
  createDeleteArtifactSuccessResult,
  createHasArtifactRequest,
  createHasArtifactSuccessResult,
  createRetrieveArtifactRequest,
  createRetrieveArtifactSuccessResult,
  createStoreArtifactFailureResult,
  createStoreArtifactRequest,
  createStoreArtifactSuccessResult,
} from ".";

describe("storage contracts", () => {
  it("creates store requests with artifact descriptors and boundary context", () => {
    const request = createStoreArtifactRequest(new Uint8Array([1, 2, 3]), {
      descriptor: {
        key: " artifacts/report-1 ",
        mediaType: "application/pdf",
        sizeBytes: 3,
        checksum: {
          algorithm: "sha256",
          value: "abc123",
        },
        metadata: {
          source: "runtime",
        },
      },
      overwrite: true,
      requestId: "req-1",
      correlationId: "corr-1",
    });

    expect(request).toEqual({
      descriptor: {
        key: "artifacts/report-1",
        mediaType: "application/pdf",
        sizeBytes: 3,
        checksum: {
          algorithm: "sha256",
          value: "abc123",
        },
        metadata: {
          source: "runtime",
        },
      },
      content: new Uint8Array([1, 2, 3]),
      overwrite: true,
      requestId: "req-1",
      correlationId: "corr-1",
    });
  });

  it("rejects empty artifact keys for key-based storage lookups and descriptors", () => {
    expect(() => createRetrieveArtifactRequest("   ")).toThrow(
      'Storage artifact key must be a non-empty, trimmed string key that remains path-agnostic. Received "   ".',
    );
    expect(() => createDeleteArtifactRequest("")).toThrow(
      'Storage artifact key must be a non-empty, trimmed string key that remains path-agnostic. Received "".',
    );
    expect(() =>
      createStoreArtifactRequest(new Uint8Array([1]), {
        descriptor: {
          key: " ",
        },
      }),
    ).toThrow(
      'Storage artifact key must be a non-empty, trimmed string key that remains path-agnostic. Received " ".',
    );
  });

  it("creates retrieve and has responses without persistence-record leakage", () => {
    const descriptor = {
      key: " artifacts/image-1 ",
      mediaType: "image/png",
      sizeBytes: 128,
      checksum: {
        algorithm: "sha256",
        value: "def456",
      },
      metadata: {
        purpose: "preview",
      },
    } as const;

    const retrieveResult = createRetrieveArtifactSuccessResult(
      descriptor,
      new Uint8Array([9, 8, 7]),
      {
        requestId: "req-2",
      },
    );

    expect(retrieveResult).toEqual({
      ok: true,
      value: {
        descriptor: {
          ...descriptor,
          key: "artifacts/image-1",
        },
        content: new Uint8Array([9, 8, 7]),
      },
      requestId: "req-2",
      correlationId: undefined,
    });

    const hasResult = createHasArtifactSuccessResult(true, {
      descriptor,
      correlationId: "corr-2",
    });

    expect(hasResult).toEqual({
      ok: true,
      value: {
        exists: true,
        descriptor: {
          ...descriptor,
          key: "artifacts/image-1",
        },
      },
      requestId: undefined,
      correlationId: "corr-2",
    });
  });

  it("creates delete success/failure results with shared contract error semantics", () => {
    const request = createDeleteArtifactRequest("artifacts/export-1", {
      requestId: "req-3",
    });

    expect(request).toEqual({
      key: "artifacts/export-1",
      requestId: "req-3",
      correlationId: undefined,
    });

    const success = createDeleteArtifactSuccessResult(false, {
      requestId: "req-3",
      correlationId: "corr-3",
    });

    expect(success).toEqual({
      ok: true,
      value: {
        deleted: false,
      },
      requestId: "req-3",
      correlationId: "corr-3",
    });

    const error = createContractError("unavailable", "Storage backend unavailable", {
      details: {
        adapter: "local-fs",
      },
      requestId: "req-3",
    });
    const failure = createDeleteArtifactFailureResult(error);

    expect(failure).toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "Storage backend unavailable",
        details: {
          adapter: "local-fs",
        },
        requestId: "req-3",
        correlationId: undefined,
      },
      requestId: "req-3",
      correlationId: undefined,
    });
  });

  it("creates explicit lookup requests for retrieve and existence checks", () => {
    const retrieveRequest = createRetrieveArtifactRequest(" artifacts/output-1 ", {
      requestId: "req-4",
      correlationId: "corr-4",
    });
    const hasRequest = createHasArtifactRequest(" artifacts/output-1 ", {
      requestId: "req-4",
    });

    expect(retrieveRequest).toEqual({
      key: "artifacts/output-1",
      requestId: "req-4",
      correlationId: "corr-4",
    });
    expect(hasRequest).toEqual({
      key: "artifacts/output-1",
      requestId: "req-4",
      correlationId: undefined,
    });
  });

  it("creates store success responses with artifact descriptor metadata", () => {
    const result = createStoreArtifactSuccessResult({
      key: " artifacts/new-file ",
      mediaType: "text/plain",
      sizeBytes: 12,
      checksum: {
        algorithm: "sha256",
        value: "ghi789",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        key: "artifacts/new-file",
        mediaType: "text/plain",
        sizeBytes: 12,
        checksum: {
          algorithm: "sha256",
          value: "ghi789",
        },
      },
      requestId: undefined,
      correlationId: undefined,
    });
  });

  it("creates store failure responses with shared contract error semantics", () => {
    const error = createContractError("unavailable", "Storage backend unavailable", {
      details: {
        adapter: "memory",
      },
      correlationId: "corr-6",
    });

    const failure = createStoreArtifactFailureResult(error, {
      requestId: "req-6",
    });

    expect(failure).toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "Storage backend unavailable",
        details: {
          adapter: "memory",
        },
        requestId: undefined,
        correlationId: "corr-6",
      },
      requestId: "req-6",
      correlationId: undefined,
    });
  });
});
