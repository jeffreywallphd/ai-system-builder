import { describe, expect, it, vi } from "vitest";

import { type LoggingPort } from "../../ports/logging";
import { type ArtifactStoragePort } from "../../ports/storage";
import { StoreImageUploadUseCase } from "../store-image-upload.use-case";
import { createContractError } from "../../../contracts/shared";
import {
  createStoreArtifactFailureResult,
  createStoreArtifactSuccessResult,
} from "../../../contracts/storage";
import type { DesktopImageUploadRequestPayload } from "../../../contracts/ipc";

function createRequest(overrides: Partial<DesktopImageUploadRequestPayload> = {}) {
  return {
    fileName: "kitten.png",
    mediaType: "image/png",
    bytes: new Uint8Array([137, 80, 78, 71]),
    boundary: {
      host: "desktop",
      source: "desktop.renderer.upload-form",
    },
    ...overrides,
  } satisfies DesktopImageUploadRequestPayload;
}

function createStoragePort(
  overrides: Partial<Record<keyof ArtifactStoragePort, unknown>> = {},
): ArtifactStoragePort {
  return {
    storeArtifact: vi.fn<ArtifactStoragePort["storeArtifact"]>(),
    retrieveArtifact: vi.fn<ArtifactStoragePort["retrieveArtifact"]>(),
    hasArtifact: vi.fn<ArtifactStoragePort["hasArtifact"]>(),
    deleteArtifact: vi.fn<ArtifactStoragePort["deleteArtifact"]>(),
    ...overrides,
  } as ArtifactStoragePort;
}

function createLoggingPort(log?: ReturnType<typeof vi.fn<LoggingPort["log"]>>) {
  return {
    log: log ?? vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined),
  } satisfies LoggingPort;
}

describe("StoreImageUploadUseCase", () => {
  it("stores a valid image upload through the storage port and returns a descriptor result", async () => {
    const storeArtifact = vi.fn<ArtifactStoragePort["storeArtifact"]>().mockResolvedValue(
      createStoreArtifactSuccessResult({
        key: "uploads/image-upload-1",
        mediaType: "image/png",
        sizeBytes: 4,
      }),
    );
    const storage = createStoragePort({ storeArtifact });
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const logging = createLoggingPort(log);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging,
      now: () => "2026-04-14T12:00:00.000Z",
    });

    const result = await useCase.execute(createRequest(), {
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/image-upload-1",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
    });
    expect(storeArtifact).toHaveBeenCalledWith({
      descriptor: {
        mediaType: "image/png",
        metadata: {
          originalFileName: "kitten.png",
        },
      },
      content: new Uint8Array([137, 80, 78, 71]),
      overwrite: undefined,
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
    });
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      event: "application.image-upload.store.started",
      useCase: "StoreImageUploadUseCase",
      operation: "image.upload",
      level: "info",
    });
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.succeeded",
      outcome: "success",
      level: "info",
      useCase: "StoreImageUploadUseCase",
    });
  });

  it("fails validation for non-image media types and logs a failed outcome", async () => {
    const storeArtifact = vi.fn<ArtifactStoragePort["storeArtifact"]>();
    const storage = createStoragePort({ storeArtifact });
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
      now: () => "2026-04-14T12:00:00.000Z",
    });

    const result = await useCase.execute(
      createRequest({
        mediaType: "application/pdf",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected media type validation failure.");
    }
    expect(result.error.code).toBe("validation");
    expect(result.error.message).toBe("mediaType must be an image media type.");
    expect(storeArtifact).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      event: "application.image-upload.store.started",
    });
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.failed",
      outcome: "failure",
      level: "warn",
      error: {
        errorType: "validation",
        errorCode: "validation",
      },
    });
  });

  it("fails validation for empty bytes and does not call storage", async () => {
    const storeArtifact = vi.fn<ArtifactStoragePort["storeArtifact"]>();
    const storage = createStoragePort({ storeArtifact });
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(
      createRequest({
        bytes: new Uint8Array([]),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected empty-bytes validation failure.");
    }
    expect(result.error.code).toBe("validation");
    expect(result.error.message).toBe("bytes must not be empty.");
    expect(storeArtifact).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.failed",
      error: {
        errorType: "validation",
      },
    });
  });

  it("returns storage failures and logs failed storage outcomes", async () => {
    const storeArtifact = vi.fn<ArtifactStoragePort["storeArtifact"]>().mockResolvedValue(
      createStoreArtifactFailureResult(
        createContractError("unavailable", "Storage adapter unavailable"),
      ),
    );
    const storage = createStoragePort({ storeArtifact });
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(createRequest());

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected storage failure.");
    }
    expect(result.error.code).toBe("unavailable");
    expect(result.error.message).toBe("Storage adapter unavailable");
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.failed",
      level: "error",
      outcome: "failure",
      error: {
        errorType: "storage",
        errorCode: "unavailable",
      },
    });
  });

  it("maps unexpected storage exceptions to internal failures and logs failure context", async () => {
    const storeArtifact = vi
      .fn<ArtifactStoragePort["storeArtifact"]>()
      .mockRejectedValue(new Error("disk exploded"));
    const storage = createStoragePort({ storeArtifact });
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(createRequest(), {
      requestId: "req-internal-1",
      correlationId: "corr-internal-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected internal failure result.");
    }

    expect(result.error.code).toBe("internal");
    expect(result.error.message).toBe("Unexpected storage failure.");
    expect(result.requestId).toBe("req-internal-1");
    expect(result.correlationId).toBe("corr-internal-1");
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.failed",
      level: "error",
      outcome: "failure",
      error: {
        errorType: "internal",
        errorCode: "internal",
        errorMessage: "disk exploded",
      },
    });
  });

  it("logs start and failure when filename is missing", async () => {
    const storage = createStoragePort();
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(
      createRequest({
        fileName: "   ",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing-file validation failure.");
    }
    expect(result.error.code).toBe("validation");
    expect(result.error.message).toBe("fileName must be provided.");
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      event: "application.image-upload.store.started",
    });
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.failed",
      error: {
        errorType: "validation",
      },
    });
  });
});
