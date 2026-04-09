import type { AssetVisibility } from "@domain/assets/AssetDomain";
import type { SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";
import type { GeneratedResultAssetStatus } from "@domain/image-assets/GeneratedResultAssetDomain";
import type {
  GeneratedResultDerivativeAvailabilityStatus,
  GeneratedResultPreviewKind,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import type {
  GeneratedResultPreviewState,
  GeneratedResultRetrievalState,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";

export class GeneratedResultMetadataReadContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GeneratedResultMetadataReadContractError";
  }
}

export const GeneratedResultMetadataReadErrorCodes = Object.freeze({
  invalidRequest: "generated-result-metadata-read-invalid-request",
  accessDenied: "generated-result-metadata-read-access-denied",
  notFound: "generated-result-metadata-read-not-found",
  internal: "generated-result-metadata-read-internal",
});

export type GeneratedResultMetadataReadErrorCode =
  typeof GeneratedResultMetadataReadErrorCodes[keyof typeof GeneratedResultMetadataReadErrorCodes];

export interface GeneratedResultMetadataReadError {
  readonly code: GeneratedResultMetadataReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type GeneratedResultMetadataReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: GeneratedResultMetadataReadError;
  };

export interface GeneratedResultMetadataPreviewSummary {
  readonly state: GeneratedResultPreviewState;
  readonly hasPreview: boolean;
  readonly primaryPreviewKind?: GeneratedResultPreviewKind;
  readonly availabilityStatus?: GeneratedResultDerivativeAvailabilityStatus;
}

export interface GeneratedResultMetadataRetrievalSummary {
  readonly state: GeneratedResultRetrievalState;
  readonly reasonCode?: string;
  readonly retryable?: boolean;
}

export interface GeneratedResultMetadataLineageSummary {
  readonly resultAssetId: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly inputAssetCount: number;
  readonly hasWorkflowTemplateVersion: boolean;
  readonly hasSystemSnapshot: boolean;
  readonly hasParameterSnapshot: boolean;
  readonly hasSelectedNode: boolean;
}

export interface GeneratedResultMetadataSummary {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly status: GeneratedResultAssetStatus;
  readonly mediaType?: SupportedImageMediaType;
  readonly visibility: AssetVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly preview: GeneratedResultMetadataPreviewSummary;
  readonly retrieval: GeneratedResultMetadataRetrievalSummary;
  readonly lineage: GeneratedResultMetadataLineageSummary;
}

export interface GeneratedResultMetadataDetail extends GeneratedResultMetadataSummary {
  readonly sharingPolicyRef?: {
    readonly policyId: string;
    readonly policyVersion?: string;
  };
  readonly storage: {
    readonly storageInstanceId: string;
    readonly storageBindingReference?: string;
  };
  readonly lifecycle: {
    readonly pendingSince: string;
    readonly logicalAssetVersionId?: string;
    readonly persistedAt?: string;
    readonly persistedBy?: string;
    readonly previewReadyAt?: string;
    readonly previewReadyBy?: string;
    readonly failedAt?: string;
    readonly failedBy?: string;
    readonly failureCode?: string;
    readonly failureMessage?: string;
    readonly archivedAt?: string;
    readonly archivedBy?: string;
  };
  readonly previewDescriptors: ReadonlyArray<{
    readonly derivativeId: string;
    readonly previewKind: GeneratedResultPreviewKind;
    readonly availabilityStatus: GeneratedResultDerivativeAvailabilityStatus;
    readonly isPrimaryPreview: boolean;
    readonly mediaType?: SupportedImageMediaType;
    readonly width?: number;
    readonly height?: number;
    readonly byteSize?: number;
    readonly protectedResourceId?: string;
    readonly accessHandle?: string;
    readonly generatedAt?: string;
    readonly failureCode?: string;
    readonly failureMessage?: string;
  }>;
  readonly lineageDetail: {
    readonly inputAssetIds: ReadonlyArray<string>;
    readonly workflowTemplateVersionId?: string;
    readonly workflowTemplateVersionTag?: string;
    readonly systemSnapshotId?: string;
    readonly systemVersionTag?: string;
    readonly parameterSnapshotId?: string;
    readonly selectedNodeId?: string;
    readonly executionAdapterKind?: string;
    readonly executionBackendFamily?: string;
    readonly updatedAt: string;
  };
}

export interface GetGeneratedResultMetadataRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultMetadataSuccess {
  readonly result: GeneratedResultMetadataDetail;
}

export interface IGetGeneratedResultMetadataUseCase {
  execute(
    request: GetGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<GetGeneratedResultMetadataSuccess>>;
}

export interface ListGeneratedResultMetadataRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly runId?: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly statuses?: ReadonlyArray<GeneratedResultAssetStatus>;
  readonly visibilities?: ReadonlyArray<AssetVisibility>;
  readonly mediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly previewStates?: ReadonlyArray<GeneratedResultPreviewState>;
  readonly hasPreview?: boolean;
  readonly includeArchived?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ListGeneratedResultMetadataSuccess {
  readonly items: ReadonlyArray<GeneratedResultMetadataSummary>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface IListGeneratedResultMetadataUseCase {
  execute(
    request: ListGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<ListGeneratedResultMetadataSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultMetadataReadContractError(`${field} is required.`);
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
    throw new GeneratedResultMetadataReadContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeOptionalPositiveInteger(
  value: number | undefined,
  field: string,
  minimum: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < minimum) {
    throw new GeneratedResultMetadataReadContractError(`${field} must be an integer >= ${String(minimum)}.`);
  }
  return value;
}

function normalizeOptionalLookupList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = [...new Set(values
    .map((value) => value.trim())
    .filter((value) => value.length > 0))];
  if (normalized.length < 1) {
    return undefined;
  }
  return Object.freeze(normalized);
}

function assertTimestampRange(
  start: string | undefined,
  end: string | undefined,
  label: string,
): void {
  if (!start || !end) {
    return;
  }
  if (new Date(end).getTime() < new Date(start).getTime()) {
    throw new GeneratedResultMetadataReadContractError(`${label} range is invalid: end must be >= start.`);
  }
}

export function validateGetGeneratedResultMetadataRequest(
  input: GetGeneratedResultMetadataRequest,
): GetGeneratedResultMetadataRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    resultAssetId: normalizeRequired(input.resultAssetId, "resultAssetId"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}

export function validateListGeneratedResultMetadataRequest(
  input: ListGeneratedResultMetadataRequest,
): ListGeneratedResultMetadataRequest {
  const createdAfter = normalizeOptionalTimestamp(input.createdAfter, "createdAfter");
  const createdBefore = normalizeOptionalTimestamp(input.createdBefore, "createdBefore");
  const updatedAfter = normalizeOptionalTimestamp(input.updatedAfter, "updatedAfter");
  const updatedBefore = normalizeOptionalTimestamp(input.updatedBefore, "updatedBefore");
  assertTimestampRange(createdAfter, createdBefore, "createdAt");
  assertTimestampRange(updatedAfter, updatedBefore, "updatedAt");

  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    ownerUserIds: normalizeOptionalLookupList(input.ownerUserIds),
    runId: normalizeOptional(input.runId),
    systemId: normalizeOptional(input.systemId),
    workflowId: normalizeOptional(input.workflowId),
    workflowTemplateId: normalizeOptional(input.workflowTemplateId),
    executionNodeId: normalizeOptional(input.executionNodeId),
    statuses: input.statuses,
    visibilities: input.visibilities,
    mediaTypes: input.mediaTypes,
    createdAfter,
    createdBefore,
    updatedAfter,
    updatedBefore,
    previewStates: input.previewStates,
    hasPreview: typeof input.hasPreview === "boolean" ? input.hasPreview : undefined,
    includeArchived: input.includeArchived ?? false,
    limit: normalizeOptionalPositiveInteger(input.limit, "limit", 1),
    offset: normalizeOptionalPositiveInteger(input.offset, "offset", 0),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
