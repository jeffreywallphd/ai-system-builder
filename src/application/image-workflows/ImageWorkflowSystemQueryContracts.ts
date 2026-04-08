import {
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";
import {
  type ImageSystemDefinitionReadinessSummary,
  type ImageSystemDefinitionStructureSummary,
} from "./ImageSystemDefinitionAuthoringContracts";
import {
  type ImageWorkflowDefinitionReadinessSummary,
  type ImageWorkflowDefinitionStructureSummary,
} from "./ImageWorkflowDefinitionAuthoringContracts";
import { ImageWorkflowSystemReadinessValidationService } from "./ImageWorkflowSystemReadinessValidationService";

const readinessService = new ImageWorkflowSystemReadinessValidationService();

export interface ImageWorkflowDefinitionDetailResult {
  readonly workflow: ImageWorkflowDefinition;
  readonly readiness: ImageWorkflowDefinitionReadinessSummary;
  readonly structure: ImageWorkflowDefinitionStructureSummary;
}

export interface GetImageWorkflowDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly workflowId: string;
  readonly includeRetired?: boolean;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
}

export interface ListImageWorkflowDefinitionsRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly visibilities?: ReadonlyArray<WorkspaceVisibility>;
  readonly operationKinds?: ReadonlyArray<string>;
  readonly lifecycleStates?: ReadonlyArray<ImageWorkflowDefinition["lifecycleState"]>;
  readonly activationStatuses?: ReadonlyArray<ImageWorkflowDefinition["activationStatus"]>;
  readonly lineageIds?: ReadonlyArray<string>;
  readonly versionTags?: ReadonlyArray<string>;
  readonly revisions?: ReadonlyArray<number>;
  readonly tags?: ReadonlyArray<string>;
  readonly includeRetired?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
}

export interface ImageWorkflowDefinitionListItem {
  readonly workflowId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly visibility: WorkspaceVisibility;
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly operationKind: string;
  readonly lifecycleState: ImageWorkflowDefinition["lifecycleState"];
  readonly activationStatus: ImageWorkflowDefinition["activationStatus"];
  readonly version: ImageWorkflowDefinition["version"];
  readonly readiness: ImageWorkflowDefinitionReadinessSummary;
  readonly updatedAt: string;
}

export interface ListImageWorkflowDefinitionsResult {
  readonly items: ReadonlyArray<ImageWorkflowDefinitionListItem>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface ImageSystemDefinitionDetailResult {
  readonly system: ImageSystemDefinition;
  readonly readiness: ImageSystemDefinitionReadinessSummary;
  readonly structure: ImageSystemDefinitionStructureSummary;
}

export interface GetImageSystemDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly systemId: string;
  readonly includeArchived?: boolean;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
}

export interface ListImageSystemDefinitionsRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly visibilities?: ReadonlyArray<WorkspaceVisibility>;
  readonly sharingPolicyIds?: ReadonlyArray<string>;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly workflowLineageIds?: ReadonlyArray<string>;
  readonly workflowVersionTags?: ReadonlyArray<string>;
  readonly workflowRevisions?: ReadonlyArray<number>;
  readonly lifecycleStates?: ReadonlyArray<ImageSystemDefinition["lifecycleState"]>;
  readonly runtimeStatuses?: ReadonlyArray<ImageSystemDefinition["runtimeStatus"]>;
  readonly tags?: ReadonlyArray<string>;
  readonly includeArchived?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
}

export interface ImageSystemDefinitionListItem {
  readonly systemId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly visibility: WorkspaceVisibility;
  readonly sharingPolicyId?: string;
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly lifecycleState: ImageSystemDefinition["lifecycleState"];
  readonly runtimeStatus: ImageSystemDefinition["runtimeStatus"];
  readonly workflowBinding: ImageSystemDefinition["workflowBinding"];
  readonly readiness: ImageSystemDefinitionReadinessSummary;
  readonly updatedAt: string;
}

export interface ListImageSystemDefinitionsResult {
  readonly items: ReadonlyArray<ImageSystemDefinitionListItem>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export function toImageWorkflowDefinitionReadinessSummary(
  workflow: ImageWorkflowDefinition,
  evaluatedAt: string,
): ImageWorkflowDefinitionReadinessSummary {
  return readinessService.evaluateWorkflowReadiness(workflow, evaluatedAt).readiness;
}

export function toImageWorkflowDefinitionStructureSummary(
  workflow: ImageWorkflowDefinition,
): ImageWorkflowDefinitionStructureSummary {
  return readinessService.evaluateWorkflowReadiness(workflow, new Date().toISOString()).structure;
}

export function toImageWorkflowDefinitionListItem(
  workflow: ImageWorkflowDefinition,
  readiness: ImageWorkflowDefinitionReadinessSummary,
): ImageWorkflowDefinitionListItem {
  return Object.freeze({
    workflowId: workflow.workflowId,
    workspaceId: workflow.ownership.workspaceId,
    ownerUserId: workflow.ownership.ownerUserId,
    visibility: workflow.ownership.visibility,
    title: workflow.display.title,
    summary: workflow.display.summary,
    tags: workflow.display.tags,
    operationKind: workflow.operationKind,
    lifecycleState: workflow.lifecycleState,
    activationStatus: workflow.activationStatus,
    version: workflow.version,
    readiness,
    updatedAt: workflow.updatedAt,
  });
}

export function toImageSystemDefinitionReadinessSummary(
  system: ImageSystemDefinition,
  evaluatedAt: string,
): ImageSystemDefinitionReadinessSummary {
  return readinessService.evaluateSystemReadiness(system, evaluatedAt).readiness;
}

export function toImageSystemDefinitionStructureSummary(
  system: ImageSystemDefinition,
): ImageSystemDefinitionStructureSummary {
  return readinessService.evaluateSystemReadiness(system, new Date().toISOString()).structure;
}

export function toImageSystemDefinitionListItem(
  system: ImageSystemDefinition,
  readiness: ImageSystemDefinitionReadinessSummary,
): ImageSystemDefinitionListItem {
  return Object.freeze({
    systemId: system.systemId,
    workspaceId: system.ownership.workspaceId,
    ownerUserId: system.ownership.ownerUserId,
    visibility: system.ownership.visibility,
    sharingPolicyId: system.ownership.sharingPolicyId,
    title: system.display.title,
    summary: system.display.summary,
    tags: system.display.tags,
    lifecycleState: system.lifecycleState,
    runtimeStatus: system.runtimeStatus,
    workflowBinding: system.workflowBinding,
    readiness,
    updatedAt: system.updatedAt,
  });
}
