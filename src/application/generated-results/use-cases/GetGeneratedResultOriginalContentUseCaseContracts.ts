import type { GeneratedResultPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";

export class GeneratedResultOriginalContentReadContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GeneratedResultOriginalContentReadContractError";
  }
}

export const GeneratedResultOriginalContentReadErrorCodes = Object.freeze({
  invalidRequest: "generated-result-original-content-invalid-request",
  accessDenied: "generated-result-original-content-access-denied",
  notFound: "generated-result-original-content-not-found",
  invalidState: "generated-result-original-content-invalid-state",
  contentUnavailable: "generated-result-original-content-unavailable",
  internal: "generated-result-original-content-internal",
});

export type GeneratedResultOriginalContentReadErrorCode =
  typeof GeneratedResultOriginalContentReadErrorCodes[keyof typeof GeneratedResultOriginalContentReadErrorCodes];

export interface GeneratedResultOriginalContentReadError {
  readonly code: GeneratedResultOriginalContentReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type GeneratedResultOriginalContentReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: GeneratedResultOriginalContentReadError;
  };

export interface GetGeneratedResultOriginalContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultOriginalContentSuccess {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mediaType: NonNullable<GeneratedResultPersistenceRecord["mediaType"]>;
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface IGetGeneratedResultOriginalContentUseCase {
  execute(
    request: GetGeneratedResultOriginalContentRequest,
  ): Promise<GeneratedResultOriginalContentReadResult<GetGeneratedResultOriginalContentSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultOriginalContentReadContractError(`${field} is required.`);
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
    throw new GeneratedResultOriginalContentReadContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

export function validateGetGeneratedResultOriginalContentRequest(
  input: GetGeneratedResultOriginalContentRequest,
): GetGeneratedResultOriginalContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}

