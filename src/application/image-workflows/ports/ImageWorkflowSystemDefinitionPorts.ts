import type { ImageWorkflowBackendTranslationReference, ImageWorkflowDefinition } from "@domain/image-workflows/ImageWorkflowDomain";
import type { ImageSystemDefinition } from "@domain/systems/ImageSystemDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";
import type { IPlatformTransactionManager } from "../../common/ports/PlatformTransactionPorts";

export const ImageWorkflowVersionSelectionStrategies = Object.freeze({
  workflowId: "workflow-id",
  lineageAndVersionTag: "lineage-version-tag",
  lineageAndRevision: "lineage-revision",
  latestRevisionInLineage: "latest-revision-in-lineage",
  latestPublishedInLineage: "latest-published-in-lineage",
  activePublishedInLineage: "active-published-in-lineage",
});

export type ImageWorkflowVersionSelectionStrategy =
  typeof ImageWorkflowVersionSelectionStrategies[keyof typeof ImageWorkflowVersionSelectionStrategies];

export interface ImageWorkflowVersionSelector {
  readonly strategy: ImageWorkflowVersionSelectionStrategy;
  readonly workflowId?: string;
  readonly lineageId?: string;
  readonly versionTag?: string;
  readonly revision?: number;
}

export interface ImageWorkflowDefinitionListQuery {
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly visibilities?: ReadonlyArray<WorkspaceVisibility>;
  readonly operationKinds?: ReadonlyArray<string>;
  readonly lifecycleStates?: ReadonlyArray<ImageWorkflowDefinition["lifecycleState"]>;
  readonly activationStatuses?: ReadonlyArray<ImageWorkflowDefinition["activationStatus"]>;
  readonly lineageIds?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly includeRetired?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ImageSystemDefinitionListQuery {
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly visibilities?: ReadonlyArray<WorkspaceVisibility>;
  readonly sharingPolicyIds?: ReadonlyArray<string>;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly workflowLineageIds?: ReadonlyArray<string>;
  readonly lifecycleStates?: ReadonlyArray<ImageSystemDefinition["lifecycleState"]>;
  readonly runtimeStatuses?: ReadonlyArray<ImageSystemDefinition["runtimeStatus"]>;
  readonly tags?: ReadonlyArray<string>;
  readonly includeArchived?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ImageWorkflowSystemMutationContext {
  readonly operationKey: string;
  readonly actorUserId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
}

export interface ImageWorkflowSystemMutationResult<TRecord> {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly record: TRecord;
}

export interface IImageWorkflowDefinitionRepository {
  findWorkflowDefinitionById(
    workflowId: string,
    query: {
      readonly workspaceId: string;
      readonly includeRetired?: boolean;
    },
  ): Promise<ImageWorkflowDefinition | undefined>;
  resolveWorkflowDefinitionVersion(
    query: {
      readonly workspaceId: string;
      readonly selector: ImageWorkflowVersionSelector;
    },
  ): Promise<ImageWorkflowDefinition | undefined>;
  listWorkflowDefinitions(query: ImageWorkflowDefinitionListQuery): Promise<ReadonlyArray<ImageWorkflowDefinition>>;
  createWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>>;
  saveWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>>;
  archiveWorkflowDefinition(
    workflowId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> | undefined>;
  getWorkflowBackendTranslationReference(
    query: {
      readonly workspaceId: string;
      readonly selector: ImageWorkflowVersionSelector;
    },
  ): Promise<ImageWorkflowBackendTranslationReference | undefined>;
}

export interface IImageSystemDefinitionRepository {
  findSystemDefinitionById(
    systemId: string,
    query: {
      readonly workspaceId: string;
      readonly includeArchived?: boolean;
    },
  ): Promise<ImageSystemDefinition | undefined>;
  listSystemDefinitions(query: ImageSystemDefinitionListQuery): Promise<ReadonlyArray<ImageSystemDefinition>>;
  createSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>>;
  saveSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>>;
  archiveSystemDefinition(
    systemId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined>;
}

export const ImageWorkflowSystemPermissionActions = Object.freeze({
  workflowCreate: "image-workflow.create",
  workflowRead: "image-workflow.read",
  workflowList: "image-workflow.list",
  workflowUpdate: "image-workflow.update",
  workflowArchive: "image-workflow.archive",
  systemCreate: "image-system.create",
  systemRead: "image-system.read",
  systemList: "image-system.list",
  systemUpdate: "image-system.update",
  systemArchive: "image-system.archive",
  versionResolve: "image-workflow.version-resolve",
  definitionValidate: "image-definition.validate",
});

export type ImageWorkflowSystemPermissionAction =
  typeof ImageWorkflowSystemPermissionActions[keyof typeof ImageWorkflowSystemPermissionActions];

export const ImageWorkflowSystemAuthorizationResourceKinds = Object.freeze({
  workflowDefinition: "image-workflow-definition",
  systemDefinition: "image-system-definition",
});

export type ImageWorkflowSystemAuthorizationResourceKind =
  typeof ImageWorkflowSystemAuthorizationResourceKinds[keyof typeof ImageWorkflowSystemAuthorizationResourceKinds];

export interface ImageWorkflowSystemAuthorizationRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly action: ImageWorkflowSystemPermissionAction;
  readonly resource: {
    readonly kind: ImageWorkflowSystemAuthorizationResourceKind;
    readonly resourceId?: string;
    readonly ownerUserId?: string;
    readonly visibility?: WorkspaceVisibility;
    readonly sharingPolicyId?: string;
  };
  readonly occurredAt?: string;
  readonly correlationId?: string;
}

export interface ImageWorkflowSystemAuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly reason?: string;
  readonly evaluatedAt: string;
}

export interface IImageWorkflowSystemAuthorizationPort {
  authorizeImageWorkflowSystemAction(
    request: ImageWorkflowSystemAuthorizationRequest,
  ): Promise<ImageWorkflowSystemAuthorizationDecision>;
}

export const ImageDefinitionValidationSeverities = Object.freeze({
  error: "error",
  warning: "warning",
  info: "info",
});

export type ImageDefinitionValidationSeverity =
  typeof ImageDefinitionValidationSeverities[keyof typeof ImageDefinitionValidationSeverities];

export interface ImageDefinitionValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: ImageDefinitionValidationSeverity;
}

export interface ImageDefinitionValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageDefinitionValidationIssue>;
  readonly evaluatedAt: string;
}

export interface IImageWorkflowDefinitionValidationService {
  validateWorkflowDefinition(
    input: {
      readonly workspaceId: string;
      readonly workflow: ImageWorkflowDefinition;
      readonly mode?: "authoring" | "publish" | "runtime";
    },
  ): Promise<ImageDefinitionValidationResult>;
}

export interface IImageSystemDefinitionValidationService {
  validateSystemDefinition(
    input: {
      readonly workspaceId: string;
      readonly system: ImageSystemDefinition;
      readonly mode?: "authoring" | "ready" | "runtime";
    },
  ): Promise<ImageDefinitionValidationResult>;
}

export const ImageWorkflowCompatibilityOutcomes = Object.freeze({
  compatible: "compatible",
  warnings: "warnings",
  incompatible: "incompatible",
});

export type ImageWorkflowCompatibilityOutcome =
  typeof ImageWorkflowCompatibilityOutcomes[keyof typeof ImageWorkflowCompatibilityOutcomes];

export interface ImageWorkflowSystemCompatibilityResult {
  readonly outcome: ImageWorkflowCompatibilityOutcome;
  readonly issues: ReadonlyArray<ImageDefinitionValidationIssue>;
}

export interface IImageWorkflowSystemCompatibilityService {
  evaluateSystemWorkflowCompatibility(
    input: {
      readonly workspaceId: string;
      readonly workflow: ImageWorkflowDefinition;
      readonly system: ImageSystemDefinition;
      readonly mode?: "strict" | "balanced" | "permissive";
    },
  ): Promise<ImageWorkflowSystemCompatibilityResult>;
}

export interface ImageWorkflowVersionResolutionRequest {
  readonly workspaceId: string;
  readonly actorUserId?: string;
  readonly selector: ImageWorkflowVersionSelector;
  readonly requireActivePublished?: boolean;
}

export interface ImageWorkflowVersionResolutionResult {
  readonly workflow?: ImageWorkflowDefinition;
  readonly resolved: boolean;
  readonly reasonCode: string;
}

export interface IImageWorkflowVersionResolutionService {
  resolveWorkflowDefinitionVersion(
    request: ImageWorkflowVersionResolutionRequest,
  ): Promise<ImageWorkflowVersionResolutionResult>;
}

export interface ImageWorkflowSystemDefinitionPorts {
  readonly workflowRepository: IImageWorkflowDefinitionRepository;
  readonly systemRepository: IImageSystemDefinitionRepository;
  readonly authorization: IImageWorkflowSystemAuthorizationPort;
  readonly workflowValidation: IImageWorkflowDefinitionValidationService;
  readonly systemValidation: IImageSystemDefinitionValidationService;
  readonly compatibility: IImageWorkflowSystemCompatibilityService;
  readonly versionResolution: IImageWorkflowVersionResolutionService;
  readonly transactionManager?: IPlatformTransactionManager;
}
