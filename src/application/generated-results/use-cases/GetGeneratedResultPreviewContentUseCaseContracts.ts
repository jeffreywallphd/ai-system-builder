import type {
  GeneratedResultDerivativeAvailabilityStatus,
  GeneratedResultPreviewKind,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import type { GeneratedResultPreviewState } from "@shared/contracts/assets/GeneratedResultTransportContracts";
import type { GeneratedResultPreviewPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";

export class GeneratedResultPreviewContentReadContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GeneratedResultPreviewContentReadContractError";
  }
}

export const GeneratedResultPreviewContentReadErrorCodes = Object.freeze({
  invalidRequest: "generated-result-preview-content-invalid-request",
  accessDenied: "generated-result-preview-content-access-denied",
  notFound: "generated-result-preview-content-not-found",
  invalidState: "generated-result-preview-content-invalid-state",
  contentUnavailable: "generated-result-preview-content-unavailable",
  internal: "generated-result-preview-content-internal",
});

export type GeneratedResultPreviewContentReadErrorCode =
  typeof GeneratedResultPreviewContentReadErrorCodes[keyof typeof GeneratedResultPreviewContentReadErrorCodes];

export interface GeneratedResultPreviewContentReadError {
  readonly code: GeneratedResultPreviewContentReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type GeneratedResultPreviewContentReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: GeneratedResultPreviewContentReadError;
  };

export interface RequestGeneratedResultPreviewContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly preferredPreviewKinds?: ReadonlyArray<GeneratedResultPreviewKind>;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface RequestGeneratedResultPreviewContentSuccess {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly state: GeneratedResultPreviewState;
  readonly available: boolean;
  readonly reasonCode?: string;
  readonly retryable?: boolean;
  readonly selected?: {
    readonly derivativeId: string;
    readonly previewKind: GeneratedResultPreviewKind;
    readonly availabilityStatus: GeneratedResultDerivativeAvailabilityStatus;
    readonly mediaType?: NonNullable<GeneratedResultPreviewPersistenceRecord["mediaType"]>;
    readonly width?: number;
    readonly height?: number;
    readonly byteSize?: number;
    readonly previewToken: string;
  };
  readonly alternatives: ReadonlyArray<{
    readonly derivativeId: string;
    readonly previewKind: GeneratedResultPreviewKind;
    readonly availabilityStatus: GeneratedResultDerivativeAvailabilityStatus;
    readonly mediaType?: NonNullable<GeneratedResultPreviewPersistenceRecord["mediaType"]>;
    readonly width?: number;
    readonly height?: number;
    readonly byteSize?: number;
    readonly failureCode?: string;
  }>;
}

export interface OpenGeneratedResultPreviewContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly previewToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenGeneratedResultPreviewContentSuccess {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mediaType: NonNullable<GeneratedResultPreviewPersistenceRecord["mediaType"]>;
  readonly sizeBytes: number;
  readonly contentDisposition: "inline";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface IRequestGeneratedResultPreviewContentUseCase {
  execute(
    request: RequestGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<RequestGeneratedResultPreviewContentSuccess>>;
}

export interface IOpenGeneratedResultPreviewContentUseCase {
  execute(
    request: OpenGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<OpenGeneratedResultPreviewContentSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultPreviewContentReadContractError(`${field} is required.`);
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
    throw new GeneratedResultPreviewContentReadContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeOptionalPreviewKinds(
  values: ReadonlyArray<GeneratedResultPreviewKind> | undefined,
): ReadonlyArray<GeneratedResultPreviewKind> | undefined {
  if (!values || values.length < 1) {
    return undefined;
  }
  const normalized = [...new Set(values.map((value) => normalizeRequired(value, "preferredPreviewKinds")))];
  return normalized.length > 0 ? Object.freeze(normalized as GeneratedResultPreviewKind[]) : undefined;
}

export function validateRequestGeneratedResultPreviewContentRequest(
  input: RequestGeneratedResultPreviewContentRequest,
): RequestGeneratedResultPreviewContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    preferredPreviewKinds: normalizeOptionalPreviewKinds(input.preferredPreviewKinds),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}

export function validateOpenGeneratedResultPreviewContentRequest(
  input: OpenGeneratedResultPreviewContentRequest,
): OpenGeneratedResultPreviewContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    previewToken: normalizeRequired(input.previewToken, "previewToken"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
