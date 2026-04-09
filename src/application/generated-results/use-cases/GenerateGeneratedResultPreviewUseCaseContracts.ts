import type { GeneratedResultPreviewKind } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import type { GeneratedResultPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";

export class GenerateGeneratedResultPreviewContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GenerateGeneratedResultPreviewContractError";
  }
}

export const GenerateGeneratedResultPreviewErrorCodes = Object.freeze({
  invalidRequest: "generated-result-preview-generation-invalid-request",
  notFound: "generated-result-preview-generation-not-found",
  invalidState: "generated-result-preview-generation-invalid-state",
  sourceUnavailable: "generated-result-preview-generation-source-unavailable",
  processingFailed: "generated-result-preview-generation-processing-failed",
  storageUnavailable: "generated-result-preview-generation-storage-unavailable",
  internal: "generated-result-preview-generation-internal",
});

export type GenerateGeneratedResultPreviewErrorCode =
  typeof GenerateGeneratedResultPreviewErrorCodes[keyof typeof GenerateGeneratedResultPreviewErrorCodes];

export interface GenerateGeneratedResultPreviewError {
  readonly code: GenerateGeneratedResultPreviewErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type GenerateGeneratedResultPreviewResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: GenerateGeneratedResultPreviewError;
  };

export interface GenerateGeneratedResultPreviewRequest {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly operationKey: string;
  readonly previewKind?: GeneratedResultPreviewKind;
  readonly forceRegenerate?: boolean;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GenerateGeneratedResultPreviewSuccess {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly derivativeId: string;
  readonly previewKind: GeneratedResultPreviewKind;
  readonly mediaType: NonNullable<GeneratedResultPersistenceRecord["mediaType"]>;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly protectedResourceId: string;
  readonly accessHandle: string;
  readonly status: "generated" | "reused";
}

export interface IGenerateGeneratedResultPreviewUseCase {
  execute(
    request: GenerateGeneratedResultPreviewRequest,
  ): Promise<GenerateGeneratedResultPreviewResult<GenerateGeneratedResultPreviewSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GenerateGeneratedResultPreviewContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalTimestamp(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new GenerateGeneratedResultPreviewContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

export function validateGenerateGeneratedResultPreviewRequest(
  input: GenerateGeneratedResultPreviewRequest,
): GenerateGeneratedResultPreviewRequest {
  return Object.freeze({
    ...input,
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    operationKey: normalizeRequired(input.operationKey, "operationKey"),
    forceRegenerate: input.forceRegenerate ?? false,
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
