import type { AssetVisibility } from "@domain/assets/AssetDomain";
import type { SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";
import type {
  GeneratedResultAssetStatus,
} from "@domain/image-assets/GeneratedResultAssetDomain";
import type {
  GeneratedResultDerivativeAvailabilityStatus,
  GeneratedResultPreviewKind,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";

export class GeneratedResultTransportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedResultTransportContractError";
  }
}

export const GeneratedResultTransportContractVersions = Object.freeze({
  v1: "generated-result-transport/v1",
} as const);

export type GeneratedResultTransportContractVersion =
  typeof GeneratedResultTransportContractVersions[keyof typeof GeneratedResultTransportContractVersions];

export const GeneratedResultTransportRoutes = Object.freeze({
  listResults: "/api/v1/generated-results",
  getResult: "/api/v1/generated-results/:resultAssetId",
  listResultsByRun: "/api/v1/image-runs/:runId/generated-results",
  requestPreview: "/api/v1/generated-results/:resultAssetId/preview",
  requestOriginalAccess: "/api/v1/generated-results/:resultAssetId/original-access",
  getLineageSummary: "/api/v1/generated-results/:resultAssetId/lineage/summary",
  getLineageDetail: "/api/v1/generated-results/:resultAssetId/lineage",
} as const);

export const GeneratedResultOriginalAccessPurposes = Object.freeze({
  downloadOriginal: "download-original",
  exportOriginal: "export-original",
  auditReadonly: "audit-readonly",
} as const);

export type GeneratedResultOriginalAccessPurpose =
  typeof GeneratedResultOriginalAccessPurposes[keyof typeof GeneratedResultOriginalAccessPurposes];

export const GeneratedResultPreviewStates = Object.freeze({
  pending: "preview-pending",
  available: "preview-available",
  failed: "preview-failed",
  unavailable: "preview-unavailable",
} as const);

export type GeneratedResultPreviewState =
  typeof GeneratedResultPreviewStates[keyof typeof GeneratedResultPreviewStates];

export const GeneratedResultRetrievalStates = Object.freeze({
  available: "retrieval-available",
  temporarilyUnavailable: "retrieval-temporarily-unavailable",
  unavailable: "retrieval-unavailable",
  resultUnavailable: "result-unavailable",
} as const);

export type GeneratedResultRetrievalState =
  typeof GeneratedResultRetrievalStates[keyof typeof GeneratedResultRetrievalStates];

export interface GeneratedResultPreviewDescriptorDto {
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
  readonly accessExpiresAt?: string;
  readonly generatedAt?: string;
  readonly failureCode?: string;
}

export interface GeneratedResultLineageSummaryDto {
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

export interface GeneratedResultLineageDetailDto {
  readonly summary: GeneratedResultLineageSummaryDto;
  readonly source: {
    readonly workflowTemplateVersionId?: string;
    readonly workflowTemplateVersionTag?: string;
    readonly systemSnapshotId?: string;
    readonly systemVersionTag?: string;
    readonly parameterSnapshotId?: string;
    readonly selectedNodeId?: string;
    readonly executionAdapterKind?: string;
    readonly executionBackendFamily?: string;
  };
  readonly upstreamInputs: ReadonlyArray<{
    readonly assetId: string;
  }>;
  readonly graph: {
    readonly nodes: ReadonlyArray<{
      readonly nodeId: string;
      readonly nodeType: "result" | "run" | "workflow" | "system" | "execution-node" | "input-asset";
      readonly referenceId: string;
      readonly label?: string;
    }>;
    readonly edges: ReadonlyArray<{
      readonly edgeId: string;
      readonly fromNodeId: string;
      readonly toNodeId: string;
      readonly relation:
        | "produced-by-run"
        | "run-used-workflow"
        | "run-targeted-system"
        | "run-executed-on-node"
        | "result-derived-from-input";
    }>;
  };
}

export interface GeneratedResultSummaryDto {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly status: GeneratedResultAssetStatus;
  readonly mediaType: SupportedImageMediaType;
  readonly visibility: AssetVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly preview: {
    readonly state: GeneratedResultPreviewState;
    readonly hasPreview: boolean;
    readonly primaryPreviewKind?: GeneratedResultPreviewKind;
    readonly availabilityStatus?: GeneratedResultDerivativeAvailabilityStatus;
  };
  readonly retrieval: {
    readonly state: GeneratedResultRetrievalState;
    readonly reasonCode?: string;
    readonly retryable?: boolean;
  };
  readonly lineage: GeneratedResultLineageSummaryDto;
}

export interface GeneratedResultDetailDto extends GeneratedResultSummaryDto {
  readonly ownerUserId?: string;
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
  readonly previewDescriptors: ReadonlyArray<GeneratedResultPreviewDescriptorDto>;
}

export interface ListGeneratedResultsRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly runId?: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly statuses?: ReadonlyArray<GeneratedResultAssetStatus>;
  readonly visibilities?: ReadonlyArray<AssetVisibility>;
  readonly mediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly search?: string;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: "createdAt" | "updatedAt" | "status";
  readonly sortDirection?: "asc" | "desc";
}

export interface ListGeneratedResultsResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly items: ReadonlyArray<GeneratedResultSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface GetGeneratedResultRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
}

export interface GetGeneratedResultResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly result: GeneratedResultDetailDto;
}

export interface ListGeneratedResultsByRunRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListGeneratedResultsByRunResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly runId: string;
  readonly items: ReadonlyArray<GeneratedResultSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface RequestGeneratedResultPreviewRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly preferredPreviewKinds?: ReadonlyArray<GeneratedResultPreviewKind>;
}

export interface RequestGeneratedResultPreviewResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly resultAssetId: string;
  readonly preview: {
    readonly state: GeneratedResultPreviewState;
    readonly available: boolean;
    readonly selected?: GeneratedResultPreviewDescriptorDto;
    readonly alternatives: ReadonlyArray<GeneratedResultPreviewDescriptorDto>;
  };
}

export interface RequestGeneratedResultOriginalAccessRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly purpose: GeneratedResultOriginalAccessPurpose;
  readonly expiresInSeconds?: number;
  readonly suggestedFileName?: string;
}

export interface RequestGeneratedResultOriginalAccessResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly resultAssetId: string;
  readonly original: {
    readonly state: GeneratedResultRetrievalState;
    readonly mediaType: SupportedImageMediaType;
    readonly byteSize?: number;
    readonly protectedResourceId: string;
    readonly accessHandle: string;
    readonly expiresAt: string;
    readonly suggestedFileName?: string;
    readonly reasonCode?: string;
    readonly retryable?: boolean;
  };
}

export interface GetGeneratedResultLineageSummaryRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
}

export interface GetGeneratedResultLineageSummaryResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly lineage: GeneratedResultLineageSummaryDto;
}

export interface GetGeneratedResultLineageDetailRequestDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
}

export interface GetGeneratedResultLineageDetailResponseDto {
  readonly contractVersion: GeneratedResultTransportContractVersion;
  readonly lineage: GeneratedResultLineageDetailDto;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultTransportContractError(`${field} is required.`);
  }
  return normalized;
}

function appendOptional(query: URLSearchParams, key: string, value?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    query.set(key, normalized);
  }
}

function appendOptionalList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      query.append(key, normalized);
    }
  }
}

export function toListGeneratedResultsQueryParams(input: ListGeneratedResultsRequestDto): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(input.workspaceId, "workspaceId"));
  appendOptional(query, "runId", input.runId);
  appendOptional(query, "systemId", input.systemId);
  appendOptional(query, "workflowId", input.workflowId);
  appendOptionalList(query, "status", input.statuses);
  appendOptionalList(query, "visibility", input.visibilities);
  appendOptionalList(query, "mediaType", input.mediaTypes);
  appendOptional(query, "search", input.search);
  appendOptional(query, "createdAfter", input.createdAfter);
  appendOptional(query, "createdBefore", input.createdBefore);
  appendOptional(query, "sortBy", input.sortBy);
  appendOptional(query, "sortDirection", input.sortDirection);
  if (typeof input.limit === "number") {
    query.set("limit", String(input.limit));
  }
  if (typeof input.offset === "number") {
    query.set("offset", String(input.offset));
  }
  return query;
}

export function toListGeneratedResultsByRunQueryParams(
  input: ListGeneratedResultsByRunRequestDto,
): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(input.workspaceId, "workspaceId"));
  if (typeof input.limit === "number") {
    query.set("limit", String(input.limit));
  }
  if (typeof input.offset === "number") {
    query.set("offset", String(input.offset));
  }
  return query;
}

export function buildGeneratedResultRoutePath(params: { readonly resultAssetId: string }): string {
  const resultAssetId = encodeURIComponent(normalizeRequired(params.resultAssetId, "resultAssetId"));
  return GeneratedResultTransportRoutes.getResult.replace(":resultAssetId", resultAssetId);
}

export function buildGeneratedResultByRunRoutePath(params: { readonly runId: string }): string {
  const runId = encodeURIComponent(normalizeRequired(params.runId, "runId"));
  return GeneratedResultTransportRoutes.listResultsByRun.replace(":runId", runId);
}

export function buildGeneratedResultPreviewRoutePath(params: { readonly resultAssetId: string }): string {
  const resultAssetId = encodeURIComponent(normalizeRequired(params.resultAssetId, "resultAssetId"));
  return GeneratedResultTransportRoutes.requestPreview.replace(":resultAssetId", resultAssetId);
}

export function buildGeneratedResultOriginalAccessRoutePath(params: { readonly resultAssetId: string }): string {
  const resultAssetId = encodeURIComponent(normalizeRequired(params.resultAssetId, "resultAssetId"));
  return GeneratedResultTransportRoutes.requestOriginalAccess.replace(":resultAssetId", resultAssetId);
}

export function buildGeneratedResultLineageSummaryRoutePath(params: { readonly resultAssetId: string }): string {
  const resultAssetId = encodeURIComponent(normalizeRequired(params.resultAssetId, "resultAssetId"));
  return GeneratedResultTransportRoutes.getLineageSummary.replace(":resultAssetId", resultAssetId);
}

export function buildGeneratedResultLineageDetailRoutePath(params: { readonly resultAssetId: string }): string {
  const resultAssetId = encodeURIComponent(normalizeRequired(params.resultAssetId, "resultAssetId"));
  return GeneratedResultTransportRoutes.getLineageDetail.replace(":resultAssetId", resultAssetId);
}
