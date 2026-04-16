import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { type LoggingPort } from "../../ports/logging";
import { type ArtifactStoragePort } from "../../ports/storage";
import { StoreImageUploadUseCase } from "../store-image-upload.use-case";
import { createContractError } from "../../../contracts/shared";
import {
  createStoreArtifactFailureResult,
  createStoreArtifactSuccessResult,
} from "../../../contracts/storage";
import type {
  StoreImageUploadCommand,
  StoreImageUploadCommandContext,
} from "../store-image-upload.types";

function createCommand(overrides: Partial<StoreImageUploadCommand> = {}) {
  return {
    fileName: "kitten.png",
    mediaType: "image/png",
    bytes: new Uint8Array([137, 80, 78, 71]),
    ...overrides,
  } satisfies StoreImageUploadCommand;
}


function createCommandContext(
  overrides: Partial<StoreImageUploadCommandContext> = {},
): StoreImageUploadCommandContext {
  return {
    source: "desktop.renderer.upload-form",
    ...overrides,
  };
}

function createStoragePort(
  overrides: Partial<Record<keyof ArtifactStoragePort, unknown>> = {},
): ArtifactStoragePort {
  return {
    storeArtifact: testDouble.fn<ArtifactStoragePort["storeArtifact"]>(),
    retrieveArtifact: testDouble.fn<ArtifactStoragePort["retrieveArtifact"]>(),
    hasArtifact: testDouble.fn<ArtifactStoragePort["hasArtifact"]>(),
    deleteArtifact: testDouble.fn<ArtifactStoragePort["deleteArtifact"]>(),
    ...overrides,
  } as ArtifactStoragePort;
}

function createLoggingPort(log?: ReturnType<typeof testDouble.fn<LoggingPort["log"]>>) {
  return {
    log: log ?? testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined),
  } satisfies LoggingPort;
}

describe("StoreImageUploadUseCase", () => {
  it("stores a valid image upload through the storage port and returns a descriptor result", async () => {
    const storeArtifact = testDouble.fn<ArtifactStoragePort["storeArtifact"]>().mockResolvedValue(
      createStoreArtifactSuccessResult({
        key: "uploads/image-upload-1",
        mediaType: "image/png",
        sizeBytes: 4,
        checksum: {
          algorithm: "sha256",
          value: "0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543",
        },
      }),
    );
    const storage = createStoragePort({ storeArtifact });
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const logging = createLoggingPort(log);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging,
      now: () => "2026-04-14T12:00:00.000Z",
    });

    const result = await useCase.execute(createCommand(), createCommandContext(), {
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        sourceKind: "upload",
        storage: {
          key: "uploads/image-upload-1",
          mediaType: "image/png",
          sizeBytes: 4,
          checksum: {
            algorithm: "sha256",
            value: "0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543",
          },
        },
        originalName: "kitten.png",
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
    expect(log.mock.calls[0]?.[0].host).toBeUndefined();
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "application.image-upload.store.succeeded",
      outcome: "success",
      level: "info",
      useCase: "StoreImageUploadUseCase",
    });
  });

  it("fails validation for non-image media types and logs a failed outcome", async () => {
    const storeArtifact = testDouble.fn<ArtifactStoragePort["storeArtifact"]>();
    const storage = createStoragePort({ storeArtifact });
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
      now: () => "2026-04-14T12:00:00.000Z",
    });

    const result = await useCase.execute(
      createCommand({
        mediaType: "application/pdf",
      }),
      createCommandContext(),
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
    const storeArtifact = testDouble.fn<ArtifactStoragePort["storeArtifact"]>();
    const storage = createStoragePort({ storeArtifact });
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(
      createCommand({
        bytes: new Uint8Array([]),
      }),
      createCommandContext(),
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
    const storeArtifact = testDouble.fn<ArtifactStoragePort["storeArtifact"]>().mockResolvedValue(
      createStoreArtifactFailureResult(
        createContractError("unavailable", "Storage adapter unavailable"),
      ),
    );
    const storage = createStoragePort({ storeArtifact });
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(createCommand(), createCommandContext());

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
    const storeArtifact = testDouble
      .fn<ArtifactStoragePort["storeArtifact"]>()
      .mockRejectedValue(new Error("disk exploded"));
    const storage = createStoragePort({ storeArtifact });
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(createCommand(), createCommandContext(), {
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
    const log = testDouble.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const useCase = new StoreImageUploadUseCase({
      storage,
      logging: createLoggingPort(log),
    });

    const result = await useCase.execute(
      createCommand({
        fileName: "   ",
      }),
      createCommandContext(),
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
