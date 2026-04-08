import type { ImageWorkflowParameterSpecification } from "@domain/image-workflows/ImageWorkflowParameterSpecification";
import {
  ImageSystemParameterValueSources,
  type ImageSystemParameterValueContract,
} from "./ImageWorkflowParameterContracts";
import type {
  ImageSystemInputSlotBindingContract,
  ImageSystemOutputSlotBindingContract,
  ImageWorkflowInputSlotBindingContract,
  ImageWorkflowOutputSlotBindingContract,
} from "./ImageWorkflowBindingContracts";

export class ImageWorkflowSystemApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowSystemApiContractError";
  }
}

export const ImageWorkflowSystemApiContractVersions = Object.freeze({
  v1: "image-workflow-system-api/v1",
} as const);

export type ImageWorkflowSystemApiContractVersion =
  typeof ImageWorkflowSystemApiContractVersions[keyof typeof ImageWorkflowSystemApiContractVersions];

export const ImageWorkflowSystemApiRoutes = Object.freeze({
  createWorkflow: "/api/v1/image-workflows",
  updateWorkflow: "/api/v1/image-workflows/:workflowId",
  getWorkflow: "/api/v1/image-workflows/:workflowId",
  listWorkflows: "/api/v1/image-workflows",
  validateWorkflow: "/api/v1/image-workflows/:workflowId/validate",
  createSystem: "/api/v1/image-systems",
  updateSystem: "/api/v1/image-systems/:systemId",
  getSystem: "/api/v1/image-systems/:systemId",
  listSystems: "/api/v1/image-systems",
  validateSystem: "/api/v1/image-systems/:systemId/validate",
} as const);

export const ImageWorkflowApiSurfaceTargets = Object.freeze({
  desktop: "desktop",
  thinClient: "thin-client",
} as const);

export type ImageWorkflowApiSurfaceTarget =
  typeof ImageWorkflowApiSurfaceTargets[keyof typeof ImageWorkflowApiSurfaceTargets];

export const ImageWorkflowApiReadinessStates = Object.freeze({
  definitionIncomplete: "definition-incomplete",
  definitionReady: "definition-ready",
  configurationIncomplete: "configuration-incomplete",
  configurationReady: "configuration-ready",
  configurationRunnable: "configuration-runnable",
} as const);

export type ImageWorkflowApiReadinessState =
  typeof ImageWorkflowApiReadinessStates[keyof typeof ImageWorkflowApiReadinessStates];

export const ImageWorkflowApiValidationSeverities = Object.freeze({
  error: "error",
  warning: "warning",
  info: "info",
} as const);

export type ImageWorkflowApiValidationSeverity =
  typeof ImageWorkflowApiValidationSeverities[keyof typeof ImageWorkflowApiValidationSeverities];

export const ImageWorkflowLifecycleStates = Object.freeze({
  draft: "draft",
  review: "review",
  published: "published",
  deprecated: "deprecated",
  retired: "retired",
} as const);

export type ImageWorkflowLifecycleState =
  typeof ImageWorkflowLifecycleStates[keyof typeof ImageWorkflowLifecycleStates];

export const ImageWorkflowActivationStatuses = Object.freeze({
  active: "active",
  inactive: "inactive",
} as const);

export type ImageWorkflowActivationStatus =
  typeof ImageWorkflowActivationStatuses[keyof typeof ImageWorkflowActivationStatuses];

export const ImageSystemLifecycleStates = Object.freeze({
  draft: "draft",
  ready: "ready",
  archived: "archived",
} as const);

export type ImageSystemLifecycleState =
  typeof ImageSystemLifecycleStates[keyof typeof ImageSystemLifecycleStates];

export const ImageSystemRuntimeStatuses = Object.freeze({
  enabled: "enabled",
  disabled: "disabled",
} as const);

export type ImageSystemRuntimeStatus =
  typeof ImageSystemRuntimeStatuses[keyof typeof ImageSystemRuntimeStatuses];

export interface ImageWorkflowApiVersionMetadataDto {
  readonly lineageId: string;
  readonly versionTag: string;
  readonly revision: number;
  readonly supersedesWorkflowId?: string;
}

export interface ImageWorkflowApiCompatibilityMetadataDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly supportedClients: ReadonlyArray<ImageWorkflowApiSurfaceTarget>;
  readonly executionAdapterId: string;
  readonly executionAdapterVersion: string;
  readonly minimumApiVersion?: string;
}

export interface ImageWorkflowApiValidationIssueDto {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: ImageWorkflowApiValidationSeverity;
}

export interface ImageWorkflowApiValidationResultDto {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageWorkflowApiValidationIssueDto>;
}

export interface ImageWorkflowApiReadinessDto {
  readonly state: ImageWorkflowApiReadinessState;
  readonly ready: boolean;
  readonly checkedAt: string;
}

export interface ImageWorkflowDefinitionSummaryDto {
  readonly workflowId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly summary?: string;
  readonly operationKind: string;
  readonly lifecycleState: ImageWorkflowLifecycleState;
  readonly activationStatus: ImageWorkflowActivationStatus;
  readonly version: ImageWorkflowApiVersionMetadataDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly updatedAt: string;
}

export interface ImageWorkflowDefinitionDto {
  readonly workflowId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly operationKind: string;
  readonly lifecycleState: ImageWorkflowLifecycleState;
  readonly activationStatus: ImageWorkflowActivationStatus;
  readonly version: ImageWorkflowApiVersionMetadataDto;
  readonly compatibility: ImageWorkflowApiCompatibilityMetadataDto;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlotBindingContract>;
  readonly outputSlots: ReadonlyArray<ImageWorkflowOutputSlotBindingContract>;
  readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageSystemWorkflowBindingDto {
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly workflowRevision: number;
  readonly workflowLineageId: string;
}

export interface ImageSystemLineageDto {
  readonly latestRunId?: string;
  readonly latestRunOccurredAt?: string;
  readonly latestOutputAssetIds: ReadonlyArray<string>;
}

export interface ImageSystemDefinitionSummaryDto {
  readonly systemId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly summary?: string;
  readonly lifecycleState: ImageSystemLifecycleState;
  readonly runtimeStatus: ImageSystemRuntimeStatus;
  readonly workflowBinding: ImageSystemWorkflowBindingDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly updatedAt: string;
}

export interface ImageSystemDefinitionDto {
  readonly systemId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly lifecycleState: ImageSystemLifecycleState;
  readonly runtimeStatus: ImageSystemRuntimeStatus;
  readonly workflowBinding: ImageSystemWorkflowBindingDto;
  readonly inputBindings: ReadonlyArray<ImageSystemInputSlotBindingContract>;
  readonly outputBindings: ReadonlyArray<ImageSystemOutputSlotBindingContract>;
  readonly parameterValues: ReadonlyArray<ImageSystemParameterValueContract>;
  readonly lineage: ImageSystemLineageDto;
  readonly compatibility: ImageWorkflowApiCompatibilityMetadataDto;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateImageWorkflowRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly workflow: ImageWorkflowDefinitionDto;
}

export interface CreateImageWorkflowResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

export interface UpdateImageWorkflowRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly workflowId: string;
  readonly expectedRevision?: number;
  readonly workflow: ImageWorkflowDefinitionDto;
}

export interface UpdateImageWorkflowResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

export interface GetImageWorkflowRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly workflowId: string;
}

export interface GetImageWorkflowResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
}

export interface ListImageWorkflowsRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly lifecycleStates?: ReadonlyArray<ImageWorkflowLifecycleState>;
  readonly activationStatuses?: ReadonlyArray<ImageWorkflowActivationStatus>;
  readonly operationKinds?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListImageWorkflowsResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly items: ReadonlyArray<ImageWorkflowDefinitionSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface ValidateImageWorkflowRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly workflowId: string;
}

export interface ValidateImageWorkflowResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

export interface CreateImageSystemRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly system: ImageSystemDefinitionDto;
}

export interface CreateImageSystemResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

export interface UpdateImageSystemRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly systemId: string;
  readonly expectedRevision?: number;
  readonly system: ImageSystemDefinitionDto;
}

export interface UpdateImageSystemResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

export interface GetImageSystemRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly systemId: string;
}

export interface GetImageSystemResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
}

export interface ListImageSystemsRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly workflowId?: string;
  readonly lifecycleStates?: ReadonlyArray<ImageSystemLifecycleState>;
  readonly runtimeStatuses?: ReadonlyArray<ImageSystemRuntimeStatus>;
  readonly tags?: ReadonlyArray<string>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListImageSystemsResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly items: ReadonlyArray<ImageSystemDefinitionSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface ValidateImageSystemRequestDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly workspaceId: string;
  readonly systemId: string;
}

export interface ValidateImageSystemResponseDto {
  readonly contractVersion: ImageWorkflowSystemApiContractVersion;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowSystemApiContractError(`${field} is required.`);
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

export function toListImageWorkflowsQueryParams(request: ListImageWorkflowsRequestDto): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  appendOptionalList(query, "lifecycleState", request.lifecycleStates);
  appendOptionalList(query, "activationStatus", request.activationStatuses);
  appendOptionalList(query, "operationKind", request.operationKinds);
  appendOptionalList(query, "tag", request.tags);
  appendOptional(query, "search", request.search);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }
  if (typeof request.offset === "number") {
    query.set("offset", String(request.offset));
  }
  return query;
}

export function toListImageSystemsQueryParams(request: ListImageSystemsRequestDto): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  appendOptional(query, "workflowId", request.workflowId);
  appendOptionalList(query, "lifecycleState", request.lifecycleStates);
  appendOptionalList(query, "runtimeStatus", request.runtimeStatuses);
  appendOptionalList(query, "tag", request.tags);
  appendOptional(query, "search", request.search);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }
  if (typeof request.offset === "number") {
    query.set("offset", String(request.offset));
  }
  return query;
}

export function createDefaultImageWorkflowApiReadiness(input: {
  readonly state: ImageWorkflowApiReadinessState;
  readonly checkedAt: string;
}): ImageWorkflowApiReadinessDto {
  return Object.freeze({
    state: input.state,
    ready: input.state === ImageWorkflowApiReadinessStates.definitionReady
      || input.state === ImageWorkflowApiReadinessStates.configurationReady
      || input.state === ImageWorkflowApiReadinessStates.configurationRunnable,
    checkedAt: input.checkedAt,
  });
}

export function createDefaultImageWorkflowApiValidationResult(
  issues: ReadonlyArray<ImageWorkflowApiValidationIssueDto> = [],
): ImageWorkflowApiValidationResultDto {
  return Object.freeze({
    valid: issues.every((issue) => issue.severity !== ImageWorkflowApiValidationSeverities.error),
    issues: Object.freeze([...issues]),
  });
}

export function isImageSystemParameterValueSource(
  value: string,
): value is ImageSystemParameterValueContract["source"] {
  return Object.values(ImageSystemParameterValueSources).includes(value as ImageSystemParameterValueContract["source"]);
}
