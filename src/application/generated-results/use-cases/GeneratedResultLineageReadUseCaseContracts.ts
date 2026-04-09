import type {
  GeneratedResultLineageDetailDto,
  GeneratedResultLineageSummaryDto,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";

export class GeneratedResultLineageReadContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GeneratedResultLineageReadContractError";
  }
}

export const GeneratedResultLineageReadErrorCodes = Object.freeze({
  invalidRequest: "generated-result-lineage-read-invalid-request",
  accessDenied: "generated-result-lineage-read-access-denied",
  notFound: "generated-result-lineage-read-not-found",
  internal: "generated-result-lineage-read-internal",
});

export type GeneratedResultLineageReadErrorCode =
  typeof GeneratedResultLineageReadErrorCodes[keyof typeof GeneratedResultLineageReadErrorCodes];

export interface GeneratedResultLineageReadError {
  readonly code: GeneratedResultLineageReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type GeneratedResultLineageReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: GeneratedResultLineageReadError;
  };

export interface GetGeneratedResultLineageRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultLineageSummarySuccess {
  readonly lineage: GeneratedResultLineageSummaryDto;
}

export interface IGetGeneratedResultLineageSummaryUseCase {
  execute(
    request: GetGeneratedResultLineageRequest,
  ): Promise<GeneratedResultLineageReadResult<GetGeneratedResultLineageSummarySuccess>>;
}

export interface GetGeneratedResultLineageDetailSuccess {
  readonly lineage: GeneratedResultLineageDetailDto;
}

export interface IGetGeneratedResultLineageDetailUseCase {
  execute(
    request: GetGeneratedResultLineageRequest,
  ): Promise<GeneratedResultLineageReadResult<GetGeneratedResultLineageDetailSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultLineageReadContractError(`${field} is required.`);
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
    throw new GeneratedResultLineageReadContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

export function validateGetGeneratedResultLineageRequest(
  input: GetGeneratedResultLineageRequest,
): GetGeneratedResultLineageRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
