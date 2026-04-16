import type { StructuredLogEvent } from "../../contracts/logging";
import { createContractError } from "../../contracts/shared";
import { IMAGE_UPLOAD_OPERATION } from "../../contracts/image-upload";
import {
  type RegisterStagedDataResult,
} from "../../contracts/ingestion";
import { createStoreArtifactRequest } from "../../contracts/storage";
import type { LoggingPort } from "../ports/logging";
import type { ArtifactStoragePort } from "../ports/storage";
import type {
  StoreImageUploadCommand,
  StoreImageUploadCommandContext,
  StoreImageUploadUseCaseResult,
} from "./store-image-upload.types";
import { mapStoreImageUploadToRegisterStagedDataResult } from "./image-upload/mapStoreImageUploadToRegisterStagedDataResult";

export interface StoreImageUploadUseCaseDependencies {
  storage: ArtifactStoragePort;
  logging: LoggingPort;
  now?: () => string;
}

type StoreImageUploadUseCaseFailure = Extract<RegisterStagedDataResult, { ok: false }>;

const STORE_IMAGE_UPLOAD_USE_CASE = "StoreImageUploadUseCase";

function getNow(now: (() => string) | undefined): string {
  return (now ?? (() => new Date().toISOString()))();
}

function isImageLikeMediaType(mediaType: string): boolean {
  return mediaType.toLowerCase().startsWith("image/");
}

function toFailureResult(
  code: "validation" | "internal",
  message: string,
  context: {
    requestId?: string;
    correlationId?: string;
  },
): StoreImageUploadUseCaseFailure {
  return mapStoreImageUploadToRegisterStagedDataResult(
    {
      ok: false,
      error: createContractError(code, message, {
        requestId: context.requestId,
        correlationId: context.correlationId,
      }),
    },
    context,
  );
}

function createBaseLogEvent(
  timestamp: string,
  level: StructuredLogEvent["level"],
  event: string,
  message: string,
  context: {
    requestId?: string;
    correlationId?: string;
  },
): StructuredLogEvent {
  return {
    timestamp,
    level,
    verbosity: "normal",
    event,
    message,
    component: "application.use-cases",
    operation: IMAGE_UPLOAD_OPERATION,
    useCase: STORE_IMAGE_UPLOAD_USE_CASE,
    requestId: context.requestId,
    correlationId: context.correlationId,
  };
}

export class StoreImageUploadUseCase {
  private readonly storage: ArtifactStoragePort;

  private readonly logging: LoggingPort;

  private readonly now: () => string;

  public constructor(dependencies: StoreImageUploadUseCaseDependencies) {
    this.storage = dependencies.storage;
    this.logging = dependencies.logging;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async execute(
    command: StoreImageUploadCommand,
    commandContext: StoreImageUploadCommandContext,
    context: {
      requestId?: string;
      correlationId?: string;
    } = {},
  ): Promise<StoreImageUploadUseCaseResult> {
    const startedAt = Date.now();
    const fileName = command.fileName.trim();
    const mediaType = command.mediaType.trim();

    await this.logging.log({
      ...createBaseLogEvent(
        getNow(this.now),
        "info",
        "application.image-upload.store.started",
        "Starting image upload storage flow",
        context,
      ),
      data: {
        fileName,
        mediaType,
        bytesLength: command.bytes.length,
        source: commandContext.source,
      },
    });

    if (fileName.length === 0) {
      const failure = toFailureResult("validation", "fileName must be provided.", context);

      await this.logging.log({
        ...createBaseLogEvent(
          getNow(this.now),
          "warn",
          "application.image-upload.store.failed",
          "Image upload validation failed",
          context,
        ),
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        error: {
          errorType: "validation",
          errorCode: failure.error.code,
          errorMessage: failure.error.message,
        },
      });

      return failure;
    }

    if (command.bytes.length === 0) {
      const failure = toFailureResult("validation", "bytes must not be empty.", context);

      await this.logging.log({
        ...createBaseLogEvent(
          getNow(this.now),
          "warn",
          "application.image-upload.store.failed",
          "Image upload validation failed",
          context,
        ),
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        error: {
          errorType: "validation",
          errorCode: failure.error.code,
          errorMessage: failure.error.message,
        },
      });

      return failure;
    }

    if (!isImageLikeMediaType(mediaType)) {
      const failure = toFailureResult(
        "validation",
        "mediaType must be an image media type.",
        context,
      );

      await this.logging.log({
        ...createBaseLogEvent(
          getNow(this.now),
          "warn",
          "application.image-upload.store.failed",
          "Image upload validation failed",
          context,
        ),
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        error: {
          errorType: "validation",
          errorCode: failure.error.code,
          errorMessage: failure.error.message,
        },
      });

      return failure;
    }

    try {
      const storeResult = await this.storage.storeArtifact(
        createStoreArtifactRequest(command.bytes, {
          descriptor: {
            mediaType,
            metadata: {
              originalFileName: fileName,
            },
          },
          requestId: context.requestId,
          correlationId: context.correlationId,
        }),
      );

      if (!storeResult.ok) {
        const failure = mapStoreImageUploadToRegisterStagedDataResult(
          {
            ok: false,
            error: storeResult.error,
          },
          context,
        );

        await this.logging.log({
          ...createBaseLogEvent(
            getNow(this.now),
            "error",
            "application.image-upload.store.failed",
            "Image upload storage failed",
            context,
          ),
          outcome: "failure",
          durationMs: Date.now() - startedAt,
          error: {
            errorType: "storage",
            errorCode: storeResult.error.code,
            errorMessage: storeResult.error.message,
            details: storeResult.error.details,
          },
        });

        return failure;
      }

      const result = mapStoreImageUploadToRegisterStagedDataResult(
        {
          ok: true,
          descriptor: storeResult.value,
          sourceKind: "upload",
          originalName: fileName,
        },
        context,
      );

      await this.logging.log({
        ...createBaseLogEvent(
          getNow(this.now),
          "info",
          "application.image-upload.store.succeeded",
          "Image upload stored successfully",
          context,
        ),
        outcome: "success",
        durationMs: Date.now() - startedAt,
        data: {
          key: storeResult.value.key,
          mediaType: storeResult.value.mediaType,
          sizeBytes: storeResult.value.sizeBytes,
        },
      });

      return result;
    } catch (error) {
      const failure = toFailureResult("internal", "Unexpected storage failure.", context);

      await this.logging.log({
        ...createBaseLogEvent(
          getNow(this.now),
          "error",
          "application.image-upload.store.failed",
          "Unexpected image upload storage failure",
          context,
        ),
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        error: {
          errorType: "internal",
          errorCode: failure.error.code,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });

      return failure;
    }
  }
}
