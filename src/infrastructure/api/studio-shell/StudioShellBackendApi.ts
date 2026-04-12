import {
  AssetDraftLifecycleStatuses,
  type AssetDraftLifecycleStatus,
  type AssetMetadata,
  type AssetMetadataPatch,
} from "@domain/studio-shell/StudioShellDomain";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import { DefaultStudioShellApplicationService } from "@application/studio-shell/DefaultStudioShellApplicationService";
import { WorkflowStudioApplicationService } from "@application/workflow-studio/WorkflowStudioApplicationService";
import {
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialImageWorkflowTemplateFamilyId,
  type InitialImageWorkflowTemplateDefinition,
} from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";
import type { IImageSystemDefinitionRepository } from "@application/image-workflows";
import {
  buildStudioShellValidationIssues,
  tryReadTaxonomyFromVersionMetadata,
  type StudioShellValidationIssue,
} from "@application/studio-shell/StudioShellValidation";
import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "@application/studio-shell/contracts";
import {
  StudioShellApplicationError,
  StudioShellErrorCodes,
  StudioShellInvalidRequestError,
} from "@application/studio-shell/StudioShellApplicationErrors";
import type { IWorkflowPersistenceRepository } from "@application/ports/interfaces/IWorkflowPersistenceRepository";
import type { IWorkflowRunSummaryRepository } from "@application/ports/interfaces/IWorkflowRunSummaryRepository";
import { CreatePersistedWorkflowUseCase } from "@application/workflow-persistence/CreatePersistedWorkflowUseCase";
import { DuplicatePersistedWorkflowUseCase } from "@application/workflow-persistence/DuplicatePersistedWorkflowUseCase";
import { GetPersistedWorkflowUseCase } from "@application/workflow-persistence/GetPersistedWorkflowUseCase";
import { UpdatePersistedWorkflowUseCase } from "@application/workflow-persistence/UpdatePersistedWorkflowUseCase";
import type {
  ProtectedResourceActorContext,
  WorkspaceScopingInput,
} from "@application/workflow-persistence/WorkflowWorkspaceScoping";
import { GetWorkflowRunDetailUseCase } from "@application/workflow-run-history/GetWorkflowRunDetailUseCase";
import { ListWorkflowRunSummariesUseCase } from "@application/workflow-run-history/ListWorkflowRunSummariesUseCase";
import {
  WorkflowPersistenceError,
  WorkflowPersistenceErrorCodes,
  WorkflowPersistenceInvalidRequestError,
} from "@application/workflow-persistence/WorkflowPersistenceErrors";
import { WorkflowLifecycleStates, deserializeWorkflowDraft } from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  createWorkflowRunDetailRecord,
  createWorkflowRunSummaryRecord,
  deriveWorkflowRunDiagnostics,
  createWorkflowStepRunStats,
  WorkflowRunStatuses,
  WorkflowRunRerunModes,
  WorkflowRunDiagnosticScopes,
  type WorkflowRunDetailRecord,
  type WorkflowRunDiagnosticRecord,
  type WorkflowRunExecutionContextRecord,
  type WorkflowRunOutputRecord,
  type WorkflowStepRunRecord,
  type WorkflowRunStatus,
  type WorkflowRunSummaryRecord,
  type WorkflowRunTriggerSource,
} from "@domain/workflow-studio/WorkflowRunHistoryDomain";
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "@application/workflow-studio/WorkflowExecutionAlignmentContracts";
import type {
  RunWorkflowDraftManualResult,
  WorkflowExecutionFailureDetail,
} from "@application/workflow-studio/WorkflowStudioApplicationService";
import {
  DataStudioPipelineExecutionService,
  type DataStudioPipelineExecutionReadiness,
  type RunDataStudioPipelineResult,
} from "@application/data-studio/DataStudioPipelineExecutionService";
import {
  createDataStudioPipelineState,
  type DataStudioPipelineState,
} from "@application/data-studio/DataStudioPipelineState";
import {
  createDataStudioPipelineVersionMetadata,
  parseDataStudioPipelineVersionMetadata,
  type DataStudioPipelineVersionSummary,
} from "@application/data-studio/DataStudioPipelineVersioning";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { UnifiedExecutionEngine } from "@application/execution/UnifiedExecutionEngine";
import { DataStudioPipelineExecutionUnitHandler } from "../../execution/DataStudioPipelineExecutionUnitHandler";
import {
  buildReferenceImageDatasetInstanceRequests,
  ReferenceImageSystemTemplate,
} from "@application/system-studio/ReferenceImageSystemTemplate";
import { validateReferenceImageCrossStudioContext } from "@application/system-studio/ReferenceImageCrossStudioIntegrity";
import { InMemoryDatasetInstanceRepository } from "@application/system-runtime/DatasetInstanceRepository";
import {
  SystemDatasetInstanceService,
  type EnsureRoleDatasetInstanceRequest,
} from "@application/system-runtime/SystemDatasetInstanceService";
import type { StorageInstanceProvisioningContract } from "@application/system-runtime/StorageInstanceProvisioningContract";
import { assertNoUserManagedStoragePaths } from "@application/system-runtime/StoragePathPolicyValidation";
import {
  DeterministicStorageInstanceProvisioner,
  InMemoryStorageInstanceMetadataRepository,
  StorageInstanceInitializationService,
  type StorageInstanceMetadataRepository,
} from "@application/system-runtime/StorageInstanceInitializationService";
import {
  StorageInstanceLifecycleService,
  type StorageInstanceLifecycleInfrastructure,
} from "@application/system-runtime/StorageInstanceLifecycleService";
import type { StorageAttachmentOwnerKind, StorageInstanceMetadata } from "@application/system-runtime/StorageInstanceMetadataModel";
import type { DatasetInstanceAssetCatalog, DatasetInstanceAssetDefinition } from "@application/system-runtime/DatasetInstanceAssetCatalog";
import { ZodMediaDatasetValidator } from "@application/dataset-studio/adapters/validation/MediaDatasetValidator";
import { DatasetSchemaIntentIds } from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { createDefaultMediaAdapterBundle } from "@application/dataset-studio/adapters/media/MediaAdapterFactory";
import { WorkflowOutputMaterializationService } from "@application/system-runtime/WorkflowOutputMaterializationService";
import {
  InMemoryWorkflowOutputArtifactStorage,
  type WorkflowOutputArtifactStorage,
} from "@application/system-runtime/WorkflowOutputArtifactStorage";
import { InMemoryWorkflowOutputProvenanceRepository } from "@application/system-runtime/WorkflowOutputProvenanceRepository";
import { OutputGalleryDatasetIntegrationService } from "@application/system-runtime/OutputGalleryDatasetIntegrationService";
import type { OutputGalleryItem, OutputGalleryListing } from "@application/system-runtime/OutputGalleryDataContract";
import {
  ImageRunHistoryExecutionStatuses,
  type ImageRunHistoryExecutionStatus,
  type ImageRunHistoryListing,
} from "@application/system-runtime/ImageRunHistoryDataContract";
import { ImageRunHistoryService } from "@application/system-runtime/ImageRunHistoryService";
import {
  InMemoryImageRunHistoryRepository,
  type ImageRunHistoryRepository,
} from "@application/system-runtime/ImageRunHistoryRepository";
import { ComfyExecutionResultMaterializationMapper } from "../../comfyui/execution/mappers/ComfyExecutionResultMaterializationMapper";
import type { SystemContextContract } from "@domain/system-studio/SystemContextContract";
import type { DatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyEvaluationTargetKinds } from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationResponseAccessLevels,
  deriveAuthorizationResponseAccessLevel,
  shapeAuthorizationAwareResponse,
  type AuthorizationResponseAccessLevel,
} from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import {
  ImageWorkflowParameterSensitivityLevels,
  ImageWorkflowParameterUiControlKinds,
  normalizeImageWorkflowParameterSpecification,
  type ImageWorkflowParameterSpecification,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";
import {
  createStudioImageSystemDefinitionUseCases,
  resolveStudioTemplateWorkflowDefinitionById,
  toSystemIdFromDraft,
  toSystemUpdateRequest,
  toSystemUpsertRequest,
  type GetImageSystemDefinitionRequest,
  type ImageSystemDefinitionDetailResult,
  type ListImageSystemDefinitionsRequest,
  type ListImageSystemDefinitionsResult,
  type StudioImageSystemDefinitionUseCases,
} from "./StudioImageSystemDefinitionSupport";

export interface StudioShellApiError {
  readonly code:
    | "not-found"
    | "conflict"
    | "invalid-request"
    | "invalid-lifecycle-transition"
    | "validation-failed"
    | "persistence-failed"
    | "internal";
  readonly message: string;
  readonly validationIssues?: ReadonlyArray<StudioShellValidationIssue>;
}

export interface StudioShellApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: StudioShellApiError;
}

export interface StudioShellSnapshotReadModel {
  readonly studioId: string;
  readonly studioName: string;
  readonly activeSessionId?: string;
  readonly sessionStatus?: string;
  readonly draft?: {
    readonly draftId: string;
    readonly assetId: string;
    readonly content: string;
    readonly revision: number;
    readonly lifecycleStatus: AssetDraftLifecycleStatus;
    readonly metadata: AssetMetadata;
    readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
    readonly publishedVersionIds: ReadonlyArray<string>;
    readonly lastPublishedVersionId?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly versions: ReadonlyArray<{
    readonly versionId: string;
    readonly versionLabel?: string;
    readonly createdAt: string;
    readonly parentVersionId?: string;
    readonly dataStudioPipeline?: DataStudioPipelineVersionSummary;
  }>;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
}

export interface ListStudioImageWorkflowDefinitionsRequest {
  readonly workspaceId?: string;
  readonly actorUserId?: string;
  readonly operationKinds?: ReadonlyArray<string>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetStudioImageWorkflowDefinitionRequest {
  readonly workspaceId?: string;
  readonly actorUserId?: string;
  readonly workflowId: string;
}

export interface StudioImageWorkflowDefinitionSummaryReadModel {
  readonly workflowId: string;
  readonly title: string;
  readonly summary: string;
  readonly operationKind: string;
  readonly version: {
    readonly lineageId: string;
    readonly versionTag: string;
    readonly revision: number;
  };
  readonly updatedAt: string;
}

export interface StudioImageWorkflowDefinitionReadModel extends StudioImageWorkflowDefinitionSummaryReadModel {
  readonly rationale: string;
  readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly parameterDefaults: Readonly<Record<string, unknown>>;
  readonly minimumRequirements: {
    readonly inputKinds: ReadonlyArray<string>;
    readonly outputKinds: ReadonlyArray<string>;
    readonly requiredParameterIds: ReadonlyArray<string>;
  };
}

export interface StudioImageWorkflowDefinitionListingReadModel {
  readonly items: ReadonlyArray<StudioImageWorkflowDefinitionSummaryReadModel>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface SaveStudioImageSystemDefinitionRequest {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly workspaceId?: string;
  readonly actorUserId?: string;
  readonly existingSystemId?: string;
  readonly saveAsNew?: boolean;
  readonly title?: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface ListStudioImageSystemDefinitionsRequest {
  readonly workspaceId?: string;
  readonly actorUserId?: string;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetStudioImageSystemDefinitionRequest {
  readonly workspaceId?: string;
  readonly actorUserId?: string;
  readonly systemId: string;
}

export interface StudioImageSystemDefinitionSummaryReadModel {
  readonly systemId: string;
  readonly title: string;
  readonly summary?: string;
  readonly lifecycleState: string;
  readonly runtimeStatus: string;
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly readinessState: string;
  readonly readinessSummary: string;
  readonly readiness: StudioImageSystemReadinessReadModel;
  readonly updatedAt: string;
}

export interface StudioImageSystemDefinitionReadModel extends StudioImageSystemDefinitionSummaryReadModel {
  readonly parameterBaseline: Readonly<Record<string, unknown>>;
  readonly outputTargetBindings: ReadonlyArray<{
    readonly outputId: string;
    readonly targetReference: string;
  }>;
}

export interface StudioImageSystemReadinessIssueReadModel {
  readonly code: string;
  readonly path?: string;
  readonly message: string;
  readonly severity: "blocking" | "advisory";
}

export interface StudioImageSystemReadinessReadModel {
  readonly state: string;
  readonly summary: string;
  readonly blockingIssueCount: number;
  readonly advisoryIssueCount: number;
  readonly blockingIssues: ReadonlyArray<StudioImageSystemReadinessIssueReadModel>;
  readonly advisoryIssues: ReadonlyArray<StudioImageSystemReadinessIssueReadModel>;
}

export interface StudioImageSystemDefinitionListingReadModel {
  readonly items: ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface ValidateStudioShellDraftRequest {
  readonly studioId: string;
  readonly draftId: string;
}

export interface RunWorkflowStudioDraftRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly content: string;
  readonly triggerEntry?: {
    readonly sourceKind: WorkflowExecutionTriggerSourceKind;
    readonly triggerId?: string;
    readonly triggerType?: string;
    readonly activationType?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
  readonly inputValues?: Readonly<Record<string, unknown>>;
  readonly triggerActivation?: {
    readonly triggerId: string;
    readonly sourceKind?: WorkflowExecutionTriggerSourceKind;
    readonly triggerType?: string;
    readonly activationType?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly manualDecisionsByStepId?: Readonly<Record<string, { readonly outcome: "continue" | "approve" | "reject" } | undefined>>;
  readonly maxLoopIterations?: number;
}

export interface IngestReferenceImageUploadRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly payloadBase64: string;
  readonly sourceImageAssetId?: string;
  readonly targetDatasetBindingId?: ReferenceImageDatasetBindingId;
}

export type ReferenceImageDatasetBindingId =
  | "input-image-dataset"
  | "output-image-dataset"
  | "reference-image-dataset";

export interface IngestReferenceImageUploadReadModel {
  readonly systemId: string;
  readonly datasetBindingId: ReferenceImageDatasetBindingId;
  readonly datasetInstanceId: string;
  readonly recordId: string;
  readonly image: {
    readonly assetId: string;
    readonly width: number;
    readonly height: number;
    readonly format: string;
  };
  readonly selectedRecordId: string;
  readonly storedFilePath?: string;
}

export interface PersistReferenceImageOutputsRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly executionId: string;
  readonly sourceRecordId?: string;
  readonly sourceAssetId?: string;
  readonly parameterSnapshot?: Readonly<Record<string, unknown>>;
  readonly runtimeContext?: SystemContextContract;
  readonly workflowAssetId?: string;
  readonly workflowAssetVersionId?: string;
  readonly systemAssetId?: string;
  readonly systemVersionId?: string;
  readonly runtimeResult?: {
    readonly output?: unknown;
    readonly status?: string;
    readonly diagnostics?: ReadonlyArray<{
      readonly source?: string;
      readonly severity?: "info" | "warning" | "error";
      readonly code?: string;
      readonly message?: string;
      readonly nodeId?: string;
      readonly at?: string;
    }>;
  };
}

export const PersistReferenceImageOutputDiagnosticStages = Object.freeze({
  requestConstruction: "request-construction-failure",
  runtimeConfigurationResolution: "runtime-configuration-resolution-failure",
  executionSubmission: "execution-submission-failure",
  pollingLifecycle: "polling-lifecycle-failure",
  modelDependencyAvailability: "model-dependency-availability-failure",
  outputMaterialization: "output-materialization-failure",
});

export type PersistReferenceImageOutputDiagnosticStage =
  typeof PersistReferenceImageOutputDiagnosticStages[keyof typeof PersistReferenceImageOutputDiagnosticStages];

export interface PersistReferenceImageOutputDiagnostic {
  readonly stage: PersistReferenceImageOutputDiagnosticStage;
  readonly code: string;
  readonly userMessage: string;
  readonly technicalMessage?: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PersistReferenceImageOutputsReadModel {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly executionId: string;
  readonly materializationId: string;
  readonly persistedRecordIds: ReadonlyArray<string>;
  readonly status: "materialized" | "partial" | "failed" | "pending";
  readonly userMessage: string;
  readonly failureMessages: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<PersistReferenceImageOutputDiagnostic>;
  readonly executionOutcome: "success" | "partial-failure" | "recoverable-failure" | "non-recoverable-failure";
  readonly persistenceBlocked: boolean;
}

export interface ListReferenceImageOutputsRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly authorization?: ReferenceImageAccessAuthorizationContext;
}

export interface GetReferenceImageOutputRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly recordId: string;
  readonly authorization?: ReferenceImageAccessAuthorizationContext;
}

export interface ListReferenceImageDatasetItemsRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly datasetBindingId: ReferenceImageDatasetBindingId;
  readonly limit?: number;
  readonly offset?: number;
  readonly authorization?: ReferenceImageAccessAuthorizationContext;
}

export interface GetReferenceImageDatasetItemRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly datasetBindingId: ReferenceImageDatasetBindingId;
  readonly recordId: string;
  readonly authorization?: ReferenceImageAccessAuthorizationContext;
}

export interface ReferenceImageAccessAuthorizationContext {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
  readonly asOf?: string;
}

export interface OperationalAccessAuthorizationContext {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
  readonly asOf?: string;
}

export interface ChainReferenceImageDatasetItemRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly sourceDatasetBindingId: Exclude<ReferenceImageDatasetBindingId, "input-image-dataset">;
  readonly sourceRecordId: string;
  readonly targetDatasetBindingId?: Extract<ReferenceImageDatasetBindingId, "input-image-dataset" | "reference-image-dataset">;
}

export interface ChainReferenceImageDatasetItemReadModel {
  readonly systemId: string;
  readonly source: {
    readonly datasetBindingId: Exclude<ReferenceImageDatasetBindingId, "input-image-dataset">;
    readonly datasetInstanceId: string;
    readonly recordId: string;
  };
  readonly target: {
    readonly datasetBindingId: Extract<ReferenceImageDatasetBindingId, "input-image-dataset" | "reference-image-dataset">;
    readonly datasetInstanceId: string;
    readonly recordId: string;
    readonly selectedRecordId?: string;
  };
}

export interface ListReferenceImageRunHistoryRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly status?: ImageRunHistoryExecutionStatus;
  readonly authorization?: OperationalAccessAuthorizationContext;
}

export interface InitializeReferenceImageStorageRequest {
  readonly systemId: string;
  readonly ownerKind?: StorageAttachmentOwnerKind;
  readonly ownerRole?: string;
  readonly ownerId?: string;
  readonly embeddedSubsystemId?: string;
  readonly storageInstanceId?: string;
  readonly attachToStorageInstanceId?: string;
}

export interface ManageReferenceImageStorageLifecycleRequest {
  readonly systemId: string;
  readonly storageInstanceId: string;
  readonly operation: "initialize" | "reset" | "archive" | "cleanup" | "inspect";
}

export interface ReferenceImageStorageLifecycleDatasetSummary {
  readonly datasetBindingId?: string;
  readonly instanceId: string;
  readonly lifecycleStatus: string;
  readonly runtimeStatus: string;
  readonly cleanupStatus?: string;
  readonly imageRecordCount: number;
  readonly storageBindingAreas: ReadonlyArray<string>;
}

export interface ManageReferenceImageStorageLifecycleReadModel {
  readonly operation: ManageReferenceImageStorageLifecycleRequest["operation"];
  readonly storage: StorageInstanceMetadata;
  readonly datasets: ReadonlyArray<ReferenceImageStorageLifecycleDatasetSummary>;
}

export interface DeleteReferenceImageStorageRequest {
  readonly systemId: string;
  readonly storageInstanceId: string;
}

class StaticDatasetInstanceAssetCatalog implements DatasetInstanceAssetCatalog {
  private readonly byKey = new Map<string, DatasetInstanceAssetDefinition>();

  public constructor(definitions: ReadonlyArray<DatasetInstanceAssetDefinition>) {
    for (const definition of definitions) {
      const key = `${definition.assetId}::${definition.versionId ?? ""}`;
      this.byKey.set(key, definition);
      if (!definition.versionId) {
        this.byKey.set(definition.assetId, definition);
      }
    }
  }

  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string; }): DatasetInstanceAssetDefinition | undefined {
    const keyed = `${input.assetId.trim()}::${input.versionId?.trim() ?? ""}`;
    return this.byKey.get(keyed) ?? this.byKey.get(input.assetId.trim());
  }
}

export interface AssessWorkflowStudioExecutionReadinessRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly content: string;
  readonly triggerActivation?: {
    readonly triggerId: string;
    readonly sourceKind?: WorkflowExecutionTriggerSourceKind;
    readonly triggerType?: string;
    readonly activationType?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly inputValues?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionValidationIssueReadModel {
  readonly code: string;
  readonly stage: string;
  readonly severity: "error" | "warning";
  readonly category: string;
  readonly blocking: boolean;
  readonly message: string;
  readonly path?: string;
}

export interface WorkflowExecutionReadinessReadModel {
  readonly ready: boolean;
  readonly authoredValidation: {
    readonly ready: boolean;
    readonly blockingIssueCount: number;
    readonly warningIssueCount: number;
  };
  readonly preExecutionValidation: {
    readonly ready: boolean;
    readonly blockingIssueCount: number;
    readonly warningIssueCount: number;
  };
  readonly translationValidation: {
    readonly ready: boolean;
    readonly blockingIssueCount: number;
    readonly warningIssueCount: number;
  };
  readonly issues: ReadonlyArray<WorkflowExecutionValidationIssueReadModel>;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
}

export interface AssessDataStudioExecutionReadinessRequest {
  readonly studioId: string;
  readonly pipelineState: DataStudioPipelineState | string;
}

export interface RunDataStudioPipelineRequest {
  readonly studioId: string;
  readonly pipelineState: DataStudioPipelineState | string;
  readonly initiatedBy?: string;
  readonly executionReason?: string;
}

export interface ListDataStudioPipelinesRequest {
  readonly studioId: string;
  readonly draftId?: string;
}

export interface LoadDataStudioPipelineRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly versionId?: string;
  readonly source?: "draft" | "latest-version" | "version-id";
}

export interface DataStudioPipelineVersionReadModel {
  readonly versionId: string;
  readonly versionLabel?: string;
  readonly parentVersionId?: string;
  readonly createdAt: string;
  readonly dataStudioPipeline?: DataStudioPipelineVersionSummary;
}

export interface DataStudioPersistedPipelineReadModel {
  readonly source: "draft" | "version";
  readonly studioId: string;
  readonly draftId: string;
  readonly assetId: string;
  readonly selectedVersionId?: string;
  readonly latestVersionId?: string;
  readonly pipelineState: DataStudioPipelineState;
  readonly versions: ReadonlyArray<DataStudioPipelineVersionReadModel>;
}

export interface DataStudioExecutionReadinessIssueReadModel {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly blocking: boolean;
  readonly scope: "stage" | "transition" | "pipeline" | "graph";
  readonly stageId?: string;
  readonly relatedStageIds?: ReadonlyArray<string>;
  readonly path?: string;
}

export interface DataStudioExecutionReadinessReadModel {
  readonly ready: boolean;
  readonly executionReady: boolean;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: ReadonlyArray<DataStudioExecutionReadinessIssueReadModel>;
  readonly stageResults: ReadonlyArray<{
    readonly stageId: string;
    readonly ready: boolean;
    readonly status: "ready" | "ready-with-warnings" | "blocked" | "skipped" | "disabled";
    readonly blockingIssueCount: number;
    readonly warningIssueCount: number;
  }>;
}

export interface RunDataStudioPipelineReadModel {
  readonly launchStatus: "blocked" | "launched" | "failed";
  readonly readiness: DataStudioExecutionReadinessReadModel;
  readonly execution: {
    readonly runId?: string;
    readonly planId?: string;
    readonly state: "queued" | "running" | "completed" | "failed";
    readonly launchAccepted: boolean;
    readonly transitions: ReadonlyArray<{
      readonly unitId: string;
      readonly state: string;
      readonly message?: string;
      readonly occurredAt: string;
    }>;
  };
  readonly result?: {
    readonly pipelineId: string;
    readonly pipelineAssetId: string;
    readonly status: "completed" | "failed";
    readonly stageResults: ReadonlyArray<{
      readonly stageId: string;
      readonly order: number;
      readonly status: "completed" | "skipped" | "failed";
      readonly message: string;
      readonly resolvedAssetIds: ReadonlyArray<string>;
      readonly startedAt: string;
      readonly completedAt: string;
    }>;
    readonly preparedOutput?: {
      readonly preparedAssetId: string;
      readonly preparedAssetVersionId: string;
      readonly storageTargetId: string;
      readonly storageReference: string;
      readonly lineageId: string;
    };
    readonly lineageId?: string;
    readonly reusableAssetId?: string;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly warnings: ReadonlyArray<string>;
    readonly errors: ReadonlyArray<string>;
  };
  readonly failureMessage?: string;
}

export interface WorkflowExecutionOutputDeliveryResultReadModel {
  readonly outputId: string;
  readonly destinationType: "web-viewer" | "file-export" | "system-entry" | "prompt-response-chat";
  readonly target: string;
  readonly status: "delivered" | "failed";
  readonly detail?: string;
}

export interface RunWorkflowStudioDraftReadModel {
  readonly launchStatus: "blocked" | "launched" | "failed";
  readonly run?: {
    readonly runId: string;
    readonly workflowId: string;
    readonly status: WorkflowRunStatus;
  };
  readonly execution: {
    readonly executionId: string;
    readonly state: "queued" | "running" | "completed" | "failed";
    readonly launchAccepted: boolean;
    readonly transitions: ReadonlyArray<{
      readonly state: "queued" | "running" | "completed" | "failed";
      readonly occurredAt: string;
      readonly message: string;
    }>;
    readonly failure?: {
      readonly kind:
        | "validation-failure"
        | "translation-failure"
        | "unsupported-configuration"
        | "runtime-failure"
        | "output-delivery-failure"
        | "launch-failure";
      readonly code: string;
      readonly message: string;
      readonly stage: "validation" | "translation" | "runtime" | "output-delivery" | "launch";
      readonly issueCodes?: ReadonlyArray<string>;
    };
  };
  readonly validation: WorkflowExecutionReadinessReadModel;
  readonly planSummary?: {
    readonly stepCount: number;
    readonly triggerCount: number;
    readonly outputCount: number;
    readonly orderedStepIds: ReadonlyArray<string>;
  };
  readonly runtime?: {
    readonly status: "completed" | "failed" | "paused";
    readonly traceCount: number;
    readonly issueCount: number;
    readonly pausedAtStepId?: string;
    readonly outputDelivery?: {
      readonly deliveredCount: number;
      readonly failedCount: number;
      readonly issueCount: number;
      readonly results: ReadonlyArray<WorkflowExecutionOutputDeliveryResultReadModel>;
    };
  };
  readonly failureMessage?: string;
}

export interface PersistedWorkflowReadModel {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "saved";
  readonly lifecycleState: string;
  readonly metadata: {
    readonly summary?: string;
    readonly tags: ReadonlyArray<string>;
  };
  readonly revision: {
    readonly persistenceRevision: number;
    readonly workflowRevision: number;
    readonly versionLabel?: string;
    readonly duplicatedFromWorkflowId?: string;
  };
  readonly timestamps: {
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly savedAt?: string;
  };
  readonly serializedDraft: string;
}

export interface DuplicatePersistedWorkflowRequest {
  readonly sourceWorkflowId: string;
  readonly duplicatedWorkflowId?: string;
  readonly duplicatedWorkflowName?: string;
  readonly ownershipContext?: {
    readonly ownerId?: string;
    readonly tenantId?: string;
    readonly studioId?: string;
    readonly sessionId?: string;
    readonly workspaceId?: string;
    readonly workspaceOwnership?: {
      readonly workspaceId: string;
      readonly ownerUserId: string;
      readonly visibility: "private" | "team" | "public";
      readonly createdBy: string;
      readonly lastModifiedBy: string;
      readonly createdAt: string;
      readonly lastModifiedAt: string;
    };
  };
  readonly actorContext?: ProtectedResourceActorContext;
  readonly workspace?: WorkspaceScopingInput;
  readonly versionLabel?: string;
}

export interface ListWorkflowStudioRunsRequest {
  readonly workflowId: string;
  readonly status?: WorkflowRunStatus;
  readonly triggerSource?: WorkflowRunTriggerSource;
  readonly limit?: number;
  readonly authorization?: OperationalAccessAuthorizationContext;
}

export interface WorkflowRunRerunOverrides {
  readonly target?: Readonly<Record<string, unknown>>;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly executionMetadata?: Readonly<Record<string, unknown>>;
  readonly propertyOverrides?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly triggerSource?: WorkflowRunTriggerSource;
  readonly triggerActivation?: {
    readonly triggerId?: string;
    readonly sourceKind?: WorkflowExecutionTriggerSourceKind;
    readonly triggerType?: string;
    readonly activationType?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  };
}

export interface StartWorkflowRunRerunRequest {
  readonly sourceRunId: string;
  readonly mode?: "as-is" | "edited";
  readonly rerunReason?: string;
  readonly overrides?: WorkflowRunRerunOverrides;
  readonly authorization?: OperationalAccessAuthorizationContext;
}

export interface WorkflowRunRerunLaunchReadModel {
  readonly sourceRunId: string;
  readonly runId: string;
  readonly mode: "as-is" | "edited";
  readonly status: WorkflowRunStatus;
  readonly executionId: string;
  readonly launchStatus: "blocked" | "launched" | "failed";
  readonly failureMessage?: string;
}

export interface WorkflowRunFailureLocationReadModel {
  readonly scope: "workflow" | "step";
  readonly stepId?: string;
  readonly stepRunId?: string;
  readonly stepName?: string;
  readonly stepIndex?: number;
}

export interface WorkflowRunDiagnosticReadModel {
  readonly category: WorkflowRunDiagnosticRecord["category"];
  readonly severity: WorkflowRunDiagnosticRecord["severity"];
  readonly scope: WorkflowRunDiagnosticRecord["scope"];
  readonly summary: string;
  readonly code?: string;
  readonly technicalDetail?: string;
  readonly remediationHint?: string;
  readonly unknownState?: boolean;
  readonly location?: WorkflowRunDiagnosticRecord["location"];
}

export interface WorkflowRunSummaryReadModel {
  readonly runId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly status: WorkflowRunStatus;
  readonly triggerSource: WorkflowRunTriggerSource;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly updatedAt: string;
  readonly durationMs?: number;
  readonly outputCount?: number;
  readonly errorMessage?: string;
  readonly executionRunId: string;
  readonly workflowExecutionId?: string;
  readonly executionFlowId?: string;
  readonly triggerEventId?: string;
  readonly parentRunId?: string;
  readonly rerunMode?: "as-is" | "edited";
  readonly rerunReason?: string;
  readonly stepRunStats?: WorkflowRunSummaryRecord["stepRunStats"];
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticReadModel>;
  readonly primaryDiagnostic?: WorkflowRunDiagnosticReadModel;
  readonly failureLocation?: WorkflowRunFailureLocationReadModel;
  readonly isIncomplete?: boolean;
}

export interface WorkflowRunDetailReadModel {
  readonly runId: string;
  readonly summary: WorkflowRunSummaryReadModel;
  readonly stepRuns: WorkflowRunDetailRecord["stepRuns"];
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticReadModel>;
  readonly failureLocation?: WorkflowRunFailureLocationReadModel;
  readonly executionContext?: WorkflowRunDetailRecord["executionContext"];
  readonly outputs?: WorkflowRunDetailRecord["outputs"];
}

const WorkflowRunDetailPartialRedactionRules = Object.freeze([
  Object.freeze({ path: "executionContext.executionInput" }),
  Object.freeze({ path: "outputs.outputValues" }),
  Object.freeze({ path: "outputs.resultMessages" }),
]);

const ReferenceImageRunPartialRedactionRules = Object.freeze([
  Object.freeze({ path: "inputs.parameterSummary" }),
  Object.freeze({ path: "lineage.sourceImageAssetId" }),
  Object.freeze({ path: "lineage.sourceImageRecordId" }),
  Object.freeze({ path: "lineage.sourceDatasetInstanceId" }),
  Object.freeze({ path: "lineage.traceId" }),
]);

export class StudioShellBackendApi {
  private readonly service: DefaultStudioShellApplicationService;
  private readonly workflowStudioService: WorkflowStudioApplicationService;
  private readonly createPersistedWorkflow?: CreatePersistedWorkflowUseCase;
  private readonly updatePersistedWorkflow?: UpdatePersistedWorkflowUseCase;
  private readonly getPersistedWorkflowUseCase?: GetPersistedWorkflowUseCase;
  private readonly duplicatePersistedWorkflowUseCase?: DuplicatePersistedWorkflowUseCase;
  private readonly listWorkflowRunSummariesUseCase?: ListWorkflowRunSummariesUseCase;
  private readonly getWorkflowRunDetailUseCase?: GetWorkflowRunDetailUseCase;
  private readonly workflowRunSummaryRepository?: IWorkflowRunSummaryRepository;
  private readonly dataStudioPipelineExecutionService: DataStudioPipelineExecutionService;
  private readonly referenceImageDatasets: SystemDatasetInstanceService;
  private readonly referenceImageOutputMaterialization: WorkflowOutputMaterializationService;
  private readonly referenceImageOutputGallery: OutputGalleryDatasetIntegrationService;
  private readonly referenceImageRunHistory: ImageRunHistoryService;
  private readonly storageInitialization: StorageInstanceInitializationService;
  private readonly storageLifecycle: StorageInstanceLifecycleService;
  private readonly comfyMaterializationMapper = new ComfyExecutionResultMaterializationMapper();
  private readonly now: () => Date;
  private readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  private readonly referenceImageProtectedResourceType: string;
  private readonly referenceImageRunProtectedResourceType: string;
  private readonly workflowRunProtectedResourceType: string;
  private readonly imageWorkflowTemplateRegistry = createInitialSupportedImageWorkflowTemplateRegistry();
  private readonly createImageSystemDefinitionUseCase: StudioImageSystemDefinitionUseCases["createSystemDefinition"];
  private readonly updateImageSystemDefinitionUseCase: StudioImageSystemDefinitionUseCases["updateSystemDefinition"];
  private readonly getImageSystemDefinitionUseCase: StudioImageSystemDefinitionUseCases["getSystemDefinition"];
  private readonly listImageSystemDefinitionsUseCase: StudioImageSystemDefinitionUseCases["listSystemDefinitions"];

  constructor(
    private readonly repository: IStudioShellRepository,
    workflowPersistenceRepository?: IWorkflowPersistenceRepository,
    workflowRunSummaryRepository?: IWorkflowRunSummaryRepository,
    now: () => Date = () => new Date(),
    imageRunHistoryRepository?: ImageRunHistoryRepository,
    options?: {
      readonly storageInstanceProvisioner?: StorageInstanceProvisioningContract;
      readonly storageInstanceMetadataRepository?: StorageInstanceMetadataRepository;
      readonly workflowOutputArtifactStorage?: WorkflowOutputArtifactStorage;
      readonly storageLifecycleInfrastructure?: StorageInstanceLifecycleInfrastructure;
      readonly imageSystemDefinitionRepository?: IImageSystemDefinitionRepository;
      readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
      readonly referenceImageProtectedResourceType?: string;
      readonly referenceImageRunProtectedResourceType?: string;
      readonly workflowRunProtectedResourceType?: string;
    },
  ) {
    this.now = now;
    this.workflowRunSummaryRepository = workflowRunSummaryRepository;
    this.dataStudioPipelineExecutionService = new DataStudioPipelineExecutionService(
      new UnifiedExecutionEngine([new DataStudioPipelineExecutionUnitHandler()]),
    );
    this.service = new DefaultStudioShellApplicationService(repository);
    const datasetAssetCatalog = new StaticDatasetInstanceAssetCatalog(ReferenceImageSystemTemplate.datasetInstances.map((entry) => Object.freeze({
      assetId: entry.datasetAssetId,
      versionId: entry.datasetAssetVersionId,
      schemaIntentId: DatasetSchemaIntentIds.media,
      outputShapeKind: "image-metadata-records",
    })));
    this.referenceImageDatasets = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      datasetAssetCatalog,
      new ZodMediaDatasetValidator(),
      {
        assertSystemExists: async (systemId) => {
          await this.assertReferenceImageSystemOwnership(systemId);
        },
      },
      {
        imageMetadataExtractor: createDefaultMediaAdapterBundle().metadataExtractor,
      },
    );
    const storageMetadataRepository = options?.storageInstanceMetadataRepository ?? new InMemoryStorageInstanceMetadataRepository();
    this.referenceImageOutputMaterialization = new WorkflowOutputMaterializationService(
      this.referenceImageDatasets,
      options?.workflowOutputArtifactStorage ?? new InMemoryWorkflowOutputArtifactStorage(),
      new InMemoryWorkflowOutputProvenanceRepository(),
    );
    this.referenceImageOutputGallery = new OutputGalleryDatasetIntegrationService(this.referenceImageDatasets);
    this.referenceImageRunHistory = new ImageRunHistoryService(
      imageRunHistoryRepository ?? new InMemoryImageRunHistoryRepository(),
      this.referenceImageOutputGallery,
      this.now,
    );
    this.storageInitialization = new StorageInstanceInitializationService(
      options?.storageInstanceProvisioner ?? new DeterministicStorageInstanceProvisioner(),
      storageMetadataRepository,
      this.now,
    );
    this.storageLifecycle = new StorageInstanceLifecycleService(
      storageMetadataRepository,
      options?.storageLifecycleInfrastructure,
      this.now,
    );
    this.authorizationDecisionEvaluator = options?.authorizationDecisionEvaluator;
    this.referenceImageProtectedResourceType = options?.referenceImageProtectedResourceType?.trim()
      || "reference-image-output";
    this.referenceImageRunProtectedResourceType = options?.referenceImageRunProtectedResourceType?.trim()
      || "reference-image-run";
    this.workflowRunProtectedResourceType = options?.workflowRunProtectedResourceType?.trim()
      || "workflow-run";
    const imageSystemUseCases = createStudioImageSystemDefinitionUseCases({
      systemRepository: options?.imageSystemDefinitionRepository,
    });
    this.createImageSystemDefinitionUseCase = imageSystemUseCases.createSystemDefinition;
    this.updateImageSystemDefinitionUseCase = imageSystemUseCases.updateSystemDefinition;
    this.getImageSystemDefinitionUseCase = imageSystemUseCases.getSystemDefinition;
    this.listImageSystemDefinitionsUseCase = imageSystemUseCases.listSystemDefinitions;
    this.workflowStudioService = new WorkflowStudioApplicationService(
      this.service,
      undefined,
      undefined,
      {
        hasAssetVersionReference: async (versionId: string) => Boolean(await this.repository.getAssetVersion(versionId)),
      },
    );
    if (workflowPersistenceRepository) {
      this.createPersistedWorkflow = new CreatePersistedWorkflowUseCase(workflowPersistenceRepository);
      this.updatePersistedWorkflow = new UpdatePersistedWorkflowUseCase(workflowPersistenceRepository);
      this.getPersistedWorkflowUseCase = new GetPersistedWorkflowUseCase(workflowPersistenceRepository);
      this.duplicatePersistedWorkflowUseCase = new DuplicatePersistedWorkflowUseCase(workflowPersistenceRepository);
    }
    if (workflowRunSummaryRepository) {
      this.listWorkflowRunSummariesUseCase = new ListWorkflowRunSummariesUseCase(workflowRunSummaryRepository);
      this.getWorkflowRunDetailUseCase = new GetWorkflowRunDetailUseCase(workflowRunSummaryRepository);
    }
  }

  public async initializeStudio(studioId: string, name: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.initializeStudio({ studioId, name });
      return this.requireSnapshot(studioId);
    });
  }

  public async loadSnapshot(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel | undefined>> {
    return this.wrap(async () => {
      const studio = await this.repository.getStudio(studioId.trim());
      if (!studio) {
        return undefined;
      }
      return this.requireSnapshot(studio.id);
    });
  }

  public async startSession(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.startAssetSession({ studioId });
      return this.requireSnapshot(studioId);
    });
  }

  public async createDraft(command: CreateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.createAssetDraft(command);
      await this.provisionReferenceImageTemplateRuntimeDefaults(command.studioId);
      await this.synchronizeWorkflowPersistenceFromStudioDraft(command.studioId);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async updateDraft(command: UpdateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.updateAssetDraft(command);
      await this.synchronizeWorkflowPersistenceFromStudioDraft(command.studioId, command.draftId);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async updateDependencies(command: UpdateAssetDraftDependenciesCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.updateAssetDraftDependencies(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async transitionLifecycle(command: TransitionAssetDraftLifecycleCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.transitionAssetDraftLifecycle(command);
      await this.synchronizeWorkflowPersistenceFromStudioDraft(command.studioId, command.draftId);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async publishVersion(command: PublishAssetDraftVersionCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      const published = await this.service.publishAssetDraftVersion(command);
      await this.enrichDataStudioVersionMetadataIfApplicable(published.version, published.draft.content);
      await this.synchronizeWorkflowPersistenceFromStudioDraft(command.studioId, command.draftId);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async validateDraft(request: ValidateStudioShellDraftRequest): Promise<StudioShellApiResponse<ReadonlyArray<StudioShellValidationIssue>>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      if (snapshot.draft?.draftId !== request.draftId) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      return snapshot.validationIssues;
    });
  }

  public async listImageWorkflowDefinitions(
    request: ListStudioImageWorkflowDefinitionsRequest = {},
  ): Promise<StudioShellApiResponse<StudioImageWorkflowDefinitionListingReadModel>> {
    return this.wrap(async () => {
      if (typeof request.workspaceId === "string" && request.workspaceId.trim().length === 0) {
        throw new StudioShellInvalidRequestError("workspaceId cannot be empty when provided.");
      }
      if (typeof request.actorUserId === "string" && request.actorUserId.trim().length === 0) {
        throw new StudioShellInvalidRequestError("actorUserId cannot be empty when provided.");
      }
      const operationKinds = request.operationKinds
        ?.map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      const search = request.search?.trim().toLowerCase();
      const limit = Math.max(1, Math.min(100, request.limit ?? 50));
      const offset = Math.max(0, request.offset ?? 0);
      const updatedAt = this.now().toISOString();

      const filtered = this.imageWorkflowTemplateRegistry
        .list()
        .filter((template) => {
          if (operationKinds && operationKinds.length > 0 && !operationKinds.includes(template.operationKind)) {
            return false;
          }
          if (!search) {
            return true;
          }
          const haystack = `${template.templateFamilyId} ${template.display.title} ${template.display.summary} ${template.operationKind}`
            .toLowerCase();
          return haystack.includes(search);
        });
      const paged = filtered.slice(offset, offset + limit);

      return Object.freeze({
        items: Object.freeze(paged.map((template) => this.toImageWorkflowSummaryReadModel(template, updatedAt))),
        pagination: Object.freeze({
          limit,
          offset,
          returned: paged.length,
          hasMore: filtered.length > (offset + limit),
        }),
      });
    });
  }

  public async getImageWorkflowDefinition(
    request: GetStudioImageWorkflowDefinitionRequest,
  ): Promise<StudioShellApiResponse<StudioImageWorkflowDefinitionReadModel>> {
    return this.wrap(async () => {
      if (typeof request.workspaceId === "string" && request.workspaceId.trim().length === 0) {
        throw new StudioShellInvalidRequestError("workspaceId cannot be empty when provided.");
      }
      if (typeof request.actorUserId === "string" && request.actorUserId.trim().length === 0) {
        throw new StudioShellInvalidRequestError("actorUserId cannot be empty when provided.");
      }
      const workflowId = request.workflowId.trim();
      if (!workflowId) {
        throw new StudioShellInvalidRequestError("workflowId is required.");
      }
      const template = this.imageWorkflowTemplateRegistry.getByTemplateFamilyId(
        workflowId as InitialImageWorkflowTemplateFamilyId,
      );
      if (!template) {
        throw new Error(`not-found:Image workflow '${workflowId}' is not available.`);
      }
      return this.toImageWorkflowDefinitionReadModel(template, this.now().toISOString());
    });
  }

  public async listImageSystemDefinitions(
    request: ListStudioImageSystemDefinitionsRequest = {},
  ): Promise<StudioShellApiResponse<StudioImageSystemDefinitionListingReadModel>> {
    return this.wrap(async () => {
      const workspaceId = request.workspaceId?.trim() || "workspace:studio-shell";
      const actorUserId = request.actorUserId?.trim() || "user:studio-shell";
      const response = await this.listImageSystemDefinitionsUseCase.execute({
        workspaceId,
        actorUserId,
        workflowIds: request.workflowIds,
        search: request.search,
        limit: request.limit,
        offset: request.offset,
      } satisfies ListImageSystemDefinitionsRequest);
      return this.toImageSystemDefinitionListingReadModel(response);
    });
  }

  public async getImageSystemDefinition(
    request: GetStudioImageSystemDefinitionRequest,
  ): Promise<StudioShellApiResponse<StudioImageSystemDefinitionReadModel>> {
    return this.wrap(async () => {
      const workspaceId = request.workspaceId?.trim() || "workspace:studio-shell";
      const actorUserId = request.actorUserId?.trim() || "user:studio-shell";
      const systemId = request.systemId?.trim();
      if (!systemId) {
        throw new StudioShellInvalidRequestError("systemId is required.");
      }
      const detail = await this.getImageSystemDefinitionUseCase.execute({
        workspaceId,
        actorUserId,
        systemId,
      } satisfies GetImageSystemDefinitionRequest);
      return this.toImageSystemDefinitionReadModel(detail);
    });
  }

  public async saveImageSystemDefinition(
    request: SaveStudioImageSystemDefinitionRequest,
  ): Promise<StudioShellApiResponse<StudioImageSystemDefinitionReadModel>> {
    return this.wrap(async () => {
      const studioId = request.studioId.trim();
      const draftId = request.draftId.trim();
      const sessionId = request.sessionId.trim();
      if (!studioId || !draftId || !sessionId) {
        throw new StudioShellInvalidRequestError("studioId, sessionId, and draftId are required.");
      }
      const snapshot = await this.requireSnapshot(studioId);
      if (snapshot.draft?.draftId !== draftId) {
        throw new StudioShellInvalidRequestError(`Draft '${draftId}' is not active in studio '${studioId}'.`);
      }
      const draft = snapshot.draft;
      if (!draft) {
        throw new StudioShellInvalidRequestError("A draft is required to save an image system definition.");
      }

      const extracted = this.readStudioImageSystemDraftState(draft.content);
      if (!extracted.workflowAssetId) {
        throw new StudioShellInvalidRequestError("Select a workflow operation before saving a system definition.");
      }
      const workspaceId = request.workspaceId?.trim() || "workspace:studio-shell";
      const actorUserId = request.actorUserId?.trim() || "user:studio-shell";
      const operationKey = `image-system.save:${draftId}:${this.now().toISOString()}`;

      const workflow = resolveStudioTemplateWorkflowDefinitionById(extracted.workflowAssetId, workspaceId);
      if (!workflow) {
        throw new StudioShellInvalidRequestError(`Selected workflow '${extracted.workflowAssetId}' is not supported.`);
      }

      const existingSystemId = request.saveAsNew ? undefined : (request.existingSystemId?.trim() || extracted.imageSystemDefinitionId);
      const provisionalSystemId = existingSystemId || toSystemIdFromDraft(studioId, draftId, this.now());
      const createRequest = toSystemUpsertRequest({
        workspaceId,
        actorUserId,
        systemId: provisionalSystemId,
        title: request.title?.trim() || draft.metadata.title || "Image system",
        summary: request.summary?.trim() || draft.metadata.summary,
        tags: request.tags ?? draft.metadata.tags,
        workflow,
        workflowParameterValues: extracted.workflowParameterValuesByWorkflowId?.[workflow.workflowId] ?? {},
        datasetInstanceId: extracted.datasetInstanceId,
        operationKey,
        occurredAt: this.now().toISOString(),
      });

      const saved = existingSystemId
        ? await this.updateImageSystemDefinitionUseCase.execute(toSystemUpdateRequest({
          existing: (await this.getImageSystemDefinitionUseCase.execute({
            workspaceId,
            actorUserId,
            systemId: existingSystemId,
            includeArchived: true,
          })).system,
          actorUserId,
          occurredAt: this.now().toISOString(),
          operationKey,
          createRequest,
        }))
        : await this.createImageSystemDefinitionUseCase.execute(createRequest);

      const nextContent = this.writeStudioImageSystemDraftState(draft.content, {
        imageSystemDefinitionId: saved.system.systemId,
        workflowParameterValuesByWorkflowId: {
          ...(extracted.workflowParameterValuesByWorkflowId ?? {}),
          [saved.system.workflowBinding.workflowId]: saved.system.parameterBaseline.values,
        },
        workflowAssetId: saved.system.workflowBinding.workflowId,
        workflowVersionTag: saved.system.workflowBinding.workflowVersionTag,
      });
      await this.service.updateAssetDraft({
        studioId,
        sessionId,
        draftId,
        content: nextContent,
      });
      return this.toImageSystemDefinitionReadModel({
        system: saved.system,
        readiness: saved.readiness,
        validation: saved.validation,
        compatibility: saved.compatibility,
      });
    });
  }

  public async assessWorkflowExecutionReadiness(
    request: AssessWorkflowStudioExecutionReadinessRequest,
  ): Promise<StudioShellApiResponse<WorkflowExecutionReadinessReadModel>> {
    return this.wrap(async () => {
      if (!request.content?.trim()) {
        throw new StudioShellInvalidRequestError("Workflow draft content is required for execution readiness validation.");
      }

      if (request.draftId?.trim()) {
        const snapshot = await this.requireSnapshot(request.studioId);
        if (snapshot.draft?.draftId !== request.draftId) {
          throw new StudioShellInvalidRequestError(
            `Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`,
          );
        }
      }

      const readiness = await this.workflowStudioService.validateWorkflowDraftExecutionReadiness({
        content: request.content,
        context: {
          inputValues: request.inputValues ?? {},
          triggerActivation: request.triggerActivation,
          metadata: request.metadata,
        },
      });
      const issues = readiness.issues.map((issue) => Object.freeze({
        code: issue.code,
        stage: issue.stage,
        severity: issue.severity,
        category: issue.category,
        blocking: issue.blocking,
        message: issue.message,
        path: issue.path,
      }));
      return Object.freeze({
        ready: readiness.ready,
        authoredValidation: Object.freeze({
          ready: readiness.authoredValidation.ready,
          blockingIssueCount: readiness.authoredValidation.blockingIssueCount,
          warningIssueCount: readiness.authoredValidation.warningIssueCount,
        }),
        preExecutionValidation: Object.freeze({
          ready: readiness.preExecutionValidation.ready,
          blockingIssueCount: readiness.preExecutionValidation.blockingIssueCount,
          warningIssueCount: readiness.preExecutionValidation.warningIssueCount,
        }),
        translationValidation: Object.freeze({
          ready: readiness.translationValidation.ready,
          blockingIssueCount: readiness.translationValidation.blockingIssueCount,
          warningIssueCount: readiness.translationValidation.warningIssueCount,
        }),
        issues: Object.freeze(issues),
        blockingIssueCount: readiness.blockingIssues.length,
        warningIssueCount: readiness.warningIssues.length,
      });
    });
  }

  public async assessDataStudioExecutionReadiness(
    request: AssessDataStudioExecutionReadinessRequest,
  ): Promise<StudioShellApiResponse<DataStudioExecutionReadinessReadModel>> {
    return this.wrap(async () => {
      await this.requireSnapshot(request.studioId);
      const pipelineState = this.toDataStudioPipelineState(request.pipelineState);
      const readiness = this.dataStudioPipelineExecutionService.assessReadiness(pipelineState);
      return this.toDataStudioExecutionReadinessReadModel(readiness);
    });
  }

  public async runWorkflowDraft(request: RunWorkflowStudioDraftRequest): Promise<StudioShellApiResponse<RunWorkflowStudioDraftReadModel>> {
    return this.wrap(async () => {
      if (!request.content?.trim()) {
        throw new StudioShellInvalidRequestError("Workflow draft content is required for manual workflow execution.");
      }

      if (request.draftId?.trim()) {
        const snapshot = await this.requireSnapshot(request.studioId);
        if (snapshot.draft?.draftId !== request.draftId) {
          throw new StudioShellInvalidRequestError(
            `Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`,
          );
        }
      }

      const mappedTriggerEntry = request.triggerEntry
        ? Object.freeze({
          sourceKind: request.triggerEntry.sourceKind,
          triggerId: request.triggerEntry.triggerId,
          triggerType: request.triggerEntry.triggerType,
          activationType: request.triggerEntry.activationType,
          payload: request.triggerEntry.payload,
          metadata: request.triggerEntry.metadata,
        })
        : request.triggerActivation
          ? Object.freeze({
            sourceKind: request.triggerActivation.sourceKind ?? WorkflowExecutionTriggerSourceKinds.manualUser,
            triggerId: request.triggerActivation.triggerId,
            triggerType: request.triggerActivation.triggerType,
            activationType: request.triggerActivation.activationType,
            payload: request.triggerActivation.payload,
          })
          : Object.freeze({
            sourceKind: WorkflowExecutionTriggerSourceKinds.manualUser,
          });

      const runResult = await this.workflowStudioService.runWorkflowDraftTriggered({
        content: request.content,
        trigger: mappedTriggerEntry,
        context: {
          inputValues: request.inputValues ?? {},
          triggerActivation: request.triggerActivation,
          metadata: request.metadata,
        },
        manualDecisionsByStepId: request.manualDecisionsByStepId,
        maxLoopIterations: request.maxLoopIterations,
      });

      const issues = runResult.validation.issues.map((issue) => Object.freeze({
        code: issue.code,
        stage: issue.stage,
        severity: issue.severity,
        category: issue.category,
        blocking: issue.blocking,
        message: issue.message,
        path: issue.path,
      }));

      let runRecord: RunWorkflowStudioDraftReadModel["run"];
      if (this.workflowRunSummaryRepository) {
        let snapshot: StudioShellSnapshotReadModel | undefined;
        try {
          snapshot = await this.requireSnapshot(request.studioId);
        } catch {
          snapshot = undefined;
        }
        const workflowId = snapshot.draft?.assetId?.trim() || `workflow:${runResult.executionStatus.executionId}`;
        const workflowName = snapshot.draft?.metadata.title?.trim() || "Workflow Draft";
        const definitionVersionIdRaw = snapshot.draft?.lastPublishedVersionId?.trim();
        const definitionVersionId = definitionVersionIdRaw?.startsWith("version:")
          ? definitionVersionIdRaw
          : undefined;
        const runId = this.createWorkflowRunId(workflowId);
        const stepRuns = this.toWorkflowStepRuns(runResult);
        const status = this.toWorkflowRunStatus(runResult);
        const startedAt = runResult.executionStatus.transitions[0]?.occurredAt ?? this.now().toISOString();
        const terminalTransition = runResult.executionStatus.transitions[runResult.executionStatus.transitions.length - 1];
        const endedAt = status === WorkflowRunStatuses.running ? undefined : terminalTransition?.occurredAt ?? this.now().toISOString();
        const diagnostics = this.toWorkflowExecutionDiagnostics(runResult, stepRuns);
        const summary = createWorkflowRunSummaryRecord({
          runId,
          status,
          triggerSource: this.toWorkflowRunTriggerSource(mappedTriggerEntry.sourceKind),
          workflow: {
            workflowId,
            workflowName,
            definitionAssetId: snapshot.draft?.assetId,
            definitionVersionId,
          },
          correlation: {
            executionRunId: runId,
            workflowExecutionId: runResult.executionStatus.executionId,
            triggerEventId: this.toOptionalString(request.triggerActivation?.triggerId ?? request.triggerEntry?.triggerId),
          },
          timestamps: {
            startedAt,
            endedAt,
            updatedAt: endedAt ?? terminalTransition?.occurredAt ?? startedAt,
          },
          errorMessage: runResult.failureMessage ?? runResult.executionStatus.failure?.message,
          output: this.toWorkflowRunOutputs(runResult),
          stepRunStats: createWorkflowStepRunStats(stepRuns),
          diagnostics,
        });
        const detail = createWorkflowRunDetailRecord({
          runId,
          summary,
          stepRuns,
          diagnostics,
          executionContext: {
            executionInput: {
              target: {},
              parameters: {
                inputValues: request.inputValues ?? {},
                triggerSource: this.toWorkflowRunTriggerSource(mappedTriggerEntry.sourceKind),
                triggerActivation: request.triggerActivation,
              },
              executionMetadata: request.metadata ?? {},
              propertyOverrides: {},
            },
            resolvedTriggerContext: {
              trigger: mappedTriggerEntry,
              activation: request.triggerActivation,
            },
            runtimeContext: runResult.runtimeResult
              ? {
                status: runResult.runtimeResult.status,
                traceCount: runResult.runtimeResult.traces.length,
                issueCount: runResult.runtimeResult.issues.length,
              }
              : undefined,
          },
          outputs: this.toWorkflowRunOutputs(runResult),
        });
        await this.workflowRunSummaryRepository.upsertDetail(detail);
        runRecord = Object.freeze({
          runId,
          workflowId,
          status,
        });
      }

      return Object.freeze({
        launchStatus: runResult.launchStatus,
        run: runRecord,
        execution: Object.freeze({
          executionId: runResult.executionStatus.executionId,
          state: runResult.executionStatus.state,
          launchAccepted: runResult.executionStatus.launchAccepted,
          transitions: Object.freeze(runResult.executionStatus.transitions.map((transition) => Object.freeze({
            state: transition.state,
            occurredAt: transition.occurredAt,
            message: transition.message,
          }))),
          failure: runResult.executionStatus.failure
            ? Object.freeze({
              kind: runResult.executionStatus.failure.kind,
              code: runResult.executionStatus.failure.code,
              message: runResult.executionStatus.failure.message,
              stage: runResult.executionStatus.failure.stage,
              issueCodes: runResult.executionStatus.failure.issueCodes
                ? Object.freeze([...runResult.executionStatus.failure.issueCodes])
                : undefined,
            })
            : undefined,
        }),
        validation: Object.freeze({
          ready: runResult.validation.ready,
          authoredValidation: Object.freeze({
            ready: runResult.validation.authoredValidation.ready,
            blockingIssueCount: runResult.validation.authoredValidation.blockingIssueCount,
            warningIssueCount: runResult.validation.authoredValidation.warningIssueCount,
          }),
          preExecutionValidation: Object.freeze({
            ready: runResult.validation.preExecutionValidation.ready,
            blockingIssueCount: runResult.validation.preExecutionValidation.blockingIssueCount,
            warningIssueCount: runResult.validation.preExecutionValidation.warningIssueCount,
          }),
          translationValidation: Object.freeze({
            ready: runResult.validation.translationValidation.ready,
            blockingIssueCount: runResult.validation.translationValidation.blockingIssueCount,
            warningIssueCount: runResult.validation.translationValidation.warningIssueCount,
          }),
          issues: Object.freeze(issues),
          blockingIssueCount: runResult.validation.blockingIssues.length,
          warningIssueCount: runResult.validation.warningIssues.length,
        }),
        planSummary: runResult.validation.plan
          ? Object.freeze({
            stepCount: runResult.validation.plan.orderedStepIds.length,
            triggerCount: runResult.validation.plan.triggers.length,
            outputCount: runResult.validation.plan.outputs.length,
            orderedStepIds: Object.freeze([...runResult.validation.plan.orderedStepIds]),
          })
          : undefined,
        runtime: runResult.runtimeResult
          ? Object.freeze({
            status: runResult.runtimeResult.status,
            traceCount: runResult.runtimeResult.traces.length,
            issueCount: runResult.runtimeResult.issues.length,
            pausedAtStepId: runResult.runtimeResult.pausedAt?.stepId,
            outputDelivery: Object.freeze({
              deliveredCount: runResult.runtimeResult.outputDelivery.results.filter((entry) => entry.status === "delivered").length,
              failedCount: runResult.runtimeResult.outputDelivery.results.filter((entry) => entry.status === "failed").length,
              issueCount: runResult.runtimeResult.outputDelivery.issues.length,
              results: Object.freeze(runResult.runtimeResult.outputDelivery.results.map((entry) => Object.freeze({
                outputId: entry.outputId,
                destinationType: entry.destinationType,
                target: entry.target,
                status: entry.status,
                detail: entry.detail,
              }))),
            }),
          })
          : undefined,
        failureMessage: runResult.failureMessage,
      });
    });
  }

  public async ingestReferenceImageUpload(
    request: IngestReferenceImageUploadRequest,
  ): Promise<StudioShellApiResponse<IngestReferenceImageUploadReadModel>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = snapshot.draft;
      if (!draft) {
        throw new StudioShellInvalidRequestError("Open a system draft before uploading an image.");
      }
      if (request.draftId?.trim() && draft.draftId !== request.draftId.trim()) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      if (draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
        throw new StudioShellInvalidRequestError("Image upload is only available for the reference image template.");
      }
      const runtimeSystemId = this.resolveReferenceRuntimeSystemId(draft);

      const fileName = request.fileName.trim();
      if (!fileName) {
        throw new StudioShellInvalidRequestError("Uploaded file name is required.");
      }
      const sourceImageAssetId = request.sourceImageAssetId?.trim() || undefined;
      if (
        sourceImageAssetId
        && !sourceImageAssetId.startsWith("asset:")
        && !sourceImageAssetId.startsWith("image-asset:")
      ) {
        throw new StudioShellInvalidRequestError("sourceImageAssetId must be a logical asset identifier.");
      }
      const payload = this.decodeBase64Payload(request.payloadBase64);
      const datasetBindingId = request.targetDatasetBindingId ?? "input-image-dataset";
      const includeOptionalReferenceDatasets = datasetBindingId === "reference-image-dataset";
      const datasets = await this.ensureReferenceImageDatasetInstances(runtimeSystemId, {
        includeOptionalReferenceDatasets,
      });
      const targetDataset = datasets.get(datasetBindingId);
      if (!targetDataset) {
        throw new StudioShellInvalidRequestError(`Reference image dataset binding '${datasetBindingId}' is unavailable.`);
      }
      const storageBindingArea = datasetBindingId === "reference-image-dataset" ? "reference" : "input";
      const ingestionSource = datasetBindingId === "reference-image-dataset"
        ? "reference-image-ui-faceid-upload"
        : "reference-image-ui-upload";
      const storedFilePath = await this.materializeUploadedImagePayload({
        payload,
        fileName,
        systemId: runtimeSystemId,
        datasetBindingId,
      });

      const ingested = await this.referenceImageDatasets.ingestImageRecordIntoInstance({
        systemId: runtimeSystemId,
        instanceId: targetDataset.instanceId,
        storageReference: storedFilePath,
        storageProvider: "studio-shell-upload-cache",
        storageBindingArea,
        metadata: {
          ingestionSource,
          datasetBindingId,
          uploadedFileName: fileName,
          uploadedMimeType: request.mimeType?.trim() || "unknown",
          storedFilePath,
        },
        provenance: {
          sourceType: "upload",
          sourceReference: sourceImageAssetId
            ? sourceImageAssetId
            : `upload:${datasetBindingId}:${draft.draftId}:${fileName}`,
          sourceSystemId: runtimeSystemId,
          ingestedBy: "studio-shell-ui",
        },
        record: {
          ...(sourceImageAssetId
            ? {
              assetRef: {
                kind: "canonical-asset",
                assetId: sourceImageAssetId,
                stableId: `canonical-asset:${sourceImageAssetId}`,
                sourceSystem: "image-asset-management",
                sourceContext: {
                  sourceKind: "studio-upload",
                  datasetBindingId,
                },
                mimeTypeHint: request.mimeType?.trim(),
                formatHint: this.deriveFileFormat(fileName, request.mimeType),
              },
            }
            : {}),
          title: fileName,
          format: this.deriveFileFormat(fileName, request.mimeType),
          tags: datasetBindingId === "reference-image-dataset"
            ? ["reference", "faceid", "upload"]
            : ["input", "upload"],
        },
        metadataExtraction: {
          payload,
          includeExifInMetadata: true,
        },
      });
      if (datasetBindingId === "input-image-dataset") {
        await this.referenceImageDatasets.selectImageRecordInInstance({
          systemId: runtimeSystemId,
          instanceId: targetDataset.instanceId,
          recordId: ingested.recordId,
          selectionContext: {
            selectionMode: "single",
            reason: "latest-upload",
          },
        });
      }

      return Object.freeze({
        systemId: runtimeSystemId,
        datasetBindingId,
        datasetInstanceId: targetDataset.instanceId,
        recordId: ingested.recordId,
        image: Object.freeze({
          assetId: ingested.image.assetRef.assetId
            ?? ingested.image.assetRef.stableId
            ?? ingested.image.assetRef.outputId
            ?? ingested.recordId,
          width: ingested.image.width,
          height: ingested.image.height,
          format: ingested.image.format,
        }),
        selectedRecordId: ingested.recordId,
        storedFilePath,
      });
    });
  }

  public async persistReferenceImageOutputs(
    request: PersistReferenceImageOutputsRequest,
  ): Promise<StudioShellApiResponse<PersistReferenceImageOutputsReadModel>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = snapshot.draft;
      if (!draft) {
        throw new StudioShellInvalidRequestError("Open a system draft before saving generated images.");
      }
      if (request.draftId?.trim() && draft.draftId !== request.draftId.trim()) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      if (draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
        throw new StudioShellInvalidRequestError("Generated image saving is only available for the reference image template.");
      }

      const runtimeSystemId = this.resolveReferenceRuntimeSystemId(draft);
      const datasets = await this.ensureReferenceImageDatasetInstances(runtimeSystemId);
      const outputDataset = datasets.get("output-image-dataset");
      if (!outputDataset) {
        throw new StudioShellInvalidRequestError("Reference image output dataset is unavailable.");
      }
      const executionId = request.executionId?.trim();
      if (!executionId) {
        throw new StudioShellInvalidRequestError("executionId is required.");
      }
      const runtimeExecutionStatus = this.normalizeRuntimeExecutionStatus(request.runtimeResult?.status);
      if (runtimeExecutionStatus === "failed" || runtimeExecutionStatus === "cancelled") {
        const failureMessage = runtimeExecutionStatus === "cancelled"
          ? "Image creation was cancelled before results were saved."
          : "Something went wrong while creating this image.";
        this.referenceImageRunHistory.recordRun({
          runId: executionId,
          workflowExecutionId: executionId,
          systemId: runtimeSystemId,
          workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
          workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
          status: ImageRunHistoryExecutionStatuses.failed,
          inputImages: request.sourceAssetId?.trim()
            ? Object.freeze([Object.freeze({
              stableId: request.sourceAssetId.trim(),
              outputId: request.sourceAssetId.trim(),
              recordId: request.sourceRecordId?.trim(),
            })])
            : undefined,
          parameterSummary: request.parameterSnapshot,
          lineage: {
            status: "incomplete",
            workflowExecutionId: executionId,
            sourceImageAssetId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.assetId ?? request.sourceAssetId?.trim(),
            sourceImageRecordId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.recordId ?? request.sourceRecordId?.trim(),
            sourceDatasetInstanceId: request.runtimeContext?.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store")?.instanceId,
            workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
            workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
            systemAssetId: request.systemAssetId?.trim() || request.runtimeContext?.runtime.systemAssetId || draft.assetId,
            systemVersionId: request.systemVersionId?.trim() || draft.lastPublishedVersionId,
            outputDatasetInstanceId: outputDataset.instanceId,
            missing: [runtimeExecutionStatus],
          },
          timestamps: {
            requestedAt: this.now().toISOString(),
            updatedAt: this.now().toISOString(),
          },
        });
        return Object.freeze({
          systemId: runtimeSystemId,
          datasetInstanceId: outputDataset.instanceId,
          executionId,
          materializationId: `mat:${executionId}`,
          persistedRecordIds: Object.freeze([]),
          status: "failed",
          userMessage: failureMessage,
          failureMessages: Object.freeze([failureMessage]),
          diagnostics: Object.freeze([
            this.createReferenceImagePersistenceDiagnostic({
              stage: this.classifyExecutionFailureStage(request.runtimeResult?.diagnostics),
              code: runtimeExecutionStatus === "cancelled" ? "execution-cancelled" : "execution-failed",
              userMessage: failureMessage,
              technicalMessage: request.runtimeResult?.diagnostics?.[0]?.message
                ?? `Runtime execution reported '${runtimeExecutionStatus}'.`,
              retryable: runtimeExecutionStatus !== "cancelled",
              details: this.createRuntimeDiagnosticDetail(request.runtimeResult?.diagnostics),
            }),
          ]),
          executionOutcome: "non-recoverable-failure" as const,
          persistenceBlocked: true,
        });
      }
      const comfyResult = this.extractComfyResultFromRuntimeResult(request.runtimeResult?.output);
      if (!comfyResult) {
        const lineageStatus = request.runtimeContext?.selectedImages?.[0]?.assetRef?.assetId ? "partial" : "incomplete";
        this.referenceImageRunHistory.recordRun({
          runId: executionId,
          workflowExecutionId: executionId,
          systemId: runtimeSystemId,
          workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
          workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
          status: ImageRunHistoryExecutionStatuses.failed,
          inputImages: request.sourceAssetId?.trim()
            ? Object.freeze([Object.freeze({
              stableId: request.sourceAssetId.trim(),
              outputId: request.sourceAssetId.trim(),
              recordId: request.sourceRecordId?.trim(),
            })])
            : undefined,
          parameterSummary: request.parameterSnapshot,
          lineage: {
            status: lineageStatus,
            workflowExecutionId: executionId,
            sourceImageAssetId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.assetId,
            sourceImageRecordId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.recordId,
            sourceDatasetInstanceId: request.runtimeContext?.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store")?.instanceId,
            workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
            workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
            systemAssetId: request.systemAssetId?.trim() || request.runtimeContext?.runtime.systemAssetId || draft.assetId,
            systemVersionId: request.systemVersionId?.trim() || draft.lastPublishedVersionId,
            outputDatasetInstanceId: outputDataset.instanceId,
            missing: lineageStatus === "incomplete" ? ["source-image-ref", "runtime-output"] : ["runtime-output"],
          },
          timestamps: {
            requestedAt: this.now().toISOString(),
            updatedAt: this.now().toISOString(),
          },
        });
        return Object.freeze({
          systemId: runtimeSystemId,
          datasetInstanceId: outputDataset.instanceId,
          executionId,
          materializationId: `mat:${executionId}`,
          persistedRecordIds: Object.freeze([]),
          status: "failed",
          userMessage: "No generated images were available to save from this run.",
          failureMessages: Object.freeze(["No generated images were available to save from this run."]),
          diagnostics: Object.freeze([
            this.createReferenceImagePersistenceDiagnostic({
              stage: PersistReferenceImageOutputDiagnosticStages.pollingLifecycle,
              code: "runtime-result-missing-comfy-output",
              userMessage: "No generated images were available to save from this run.",
              technicalMessage: "Runtime result did not include a Comfy-compatible execution output payload.",
              retryable: true,
              details: this.createRuntimeDiagnosticDetail(request.runtimeResult?.diagnostics),
            }),
          ]),
          executionOutcome: "recoverable-failure" as const,
          persistenceBlocked: true,
        });
      }
      if (request.runtimeContext) {
        const integrity = validateReferenceImageCrossStudioContext(request.runtimeContext, {
          executionId,
          workflowAssetId: request.workflowAssetId,
          workflowAssetVersionId: request.workflowAssetVersionId,
          systemAssetId: request.systemAssetId,
          sourceAssetId: request.sourceAssetId,
          sourceRecordId: request.sourceRecordId,
        });
        if (!integrity.valid) {
          const failureMessages = Object.freeze(integrity.blockingIssues.map((issue) => issue.userMessage));
          this.referenceImageRunHistory.recordRun({
            runId: executionId,
            workflowExecutionId: executionId,
            systemId: runtimeSystemId,
            workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
            workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
            status: ImageRunHistoryExecutionStatuses.failed,
            parameterSummary: request.parameterSnapshot,
            lineage: {
              status: "incomplete",
              workflowExecutionId: executionId,
              sourceImageAssetId: request.runtimeContext.selectedImages?.[0]?.assetRef?.assetId ?? request.sourceAssetId?.trim(),
              sourceImageRecordId: request.runtimeContext.selectedImages?.[0]?.assetRef?.recordId ?? request.sourceRecordId?.trim(),
              sourceDatasetInstanceId: request.runtimeContext.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store")?.instanceId,
              workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
              workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
              systemAssetId: request.systemAssetId?.trim() || request.runtimeContext.runtime.systemAssetId || draft.assetId,
              systemVersionId: request.systemVersionId?.trim() || draft.lastPublishedVersionId,
              outputDatasetInstanceId: outputDataset.instanceId,
              missing: integrity.blockingIssues.map((issue) => issue.code),
            },
            timestamps: {
              requestedAt: this.now().toISOString(),
              updatedAt: this.now().toISOString(),
            },
          });
          return Object.freeze({
            systemId: runtimeSystemId,
            datasetInstanceId: outputDataset.instanceId,
            executionId,
            materializationId: `mat:${executionId}`,
            persistedRecordIds: Object.freeze([]),
            status: "failed" as const,
            userMessage: "Please choose an image and check your settings, then try again.",
            failureMessages,
            diagnostics: Object.freeze(integrity.blockingIssues.map((issue) => this.createReferenceImagePersistenceDiagnostic({
              stage: PersistReferenceImageOutputDiagnosticStages.runtimeConfigurationResolution,
              code: issue.code,
              userMessage: issue.userMessage,
              technicalMessage: issue.technicalMessage,
              retryable: true,
              details: Object.freeze({
                severity: issue.severity,
              }),
            }))),
            executionOutcome: "recoverable-failure" as const,
            persistenceBlocked: true,
          });
        }
      }

      let materialized: Awaited<ReturnType<WorkflowOutputMaterializationService["materialize"]>>;
      try {
        const mapped = this.comfyMaterializationMapper.map({
          workflowRun: {
            runId: executionId,
            workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
            workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
          },
          result: comfyResult,
          parameterSnapshot: request.parameterSnapshot,
          sourceImageRef: request.sourceAssetId?.trim()
            ? Object.freeze({
              kind: "generated-output" as const,
              stableId: request.sourceAssetId.trim(),
              outputId: request.sourceAssetId.trim(),
            })
            : undefined,
          materializationId: `mat:${executionId}`,
        });
        materialized = await this.referenceImageOutputMaterialization.materialize({
          systemId: runtimeSystemId,
          datasetInstanceId: outputDataset.instanceId,
          payload: mapped,
        });
      } catch (error) {
        const technicalMessage = error instanceof Error ? error.message : "Unknown output materialization error.";
        const stage = technicalMessage.includes("invalid-request")
          ? PersistReferenceImageOutputDiagnosticStages.requestConstruction
          : PersistReferenceImageOutputDiagnosticStages.outputMaterialization;
        const userMessage = stage === PersistReferenceImageOutputDiagnosticStages.requestConstruction
          ? "Please check your image settings and try again."
          : "Something went wrong while saving this image.";
        return Object.freeze({
          systemId: runtimeSystemId,
          datasetInstanceId: outputDataset.instanceId,
          executionId,
          materializationId: `mat:${executionId}`,
          persistedRecordIds: Object.freeze([]),
          status: "failed" as const,
          userMessage,
          failureMessages: Object.freeze([technicalMessage]),
          diagnostics: Object.freeze([
            this.createReferenceImagePersistenceDiagnostic({
              stage,
              code: stage === PersistReferenceImageOutputDiagnosticStages.requestConstruction
                ? "materialization-request-invalid"
                : "output-materialization-failed",
              userMessage,
              technicalMessage,
              retryable: stage !== PersistReferenceImageOutputDiagnosticStages.requestConstruction,
              details: Object.freeze({
                executionId,
              }),
            }),
          ]),
          executionOutcome: "recoverable-failure" as const,
          persistenceBlocked: true,
        });
      }
      this.referenceImageRunHistory.recordRun({
        runId: executionId,
        workflowExecutionId: executionId,
        systemId: runtimeSystemId,
        workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
        status: materialized.status === "materialized"
          ? ImageRunHistoryExecutionStatuses.completed
          : materialized.status === "partial"
            ? ImageRunHistoryExecutionStatuses.partial
            : materialized.status === "failed"
              ? ImageRunHistoryExecutionStatuses.failed
              : ImageRunHistoryExecutionStatuses.running,
        inputImages: request.sourceAssetId?.trim()
          ? Object.freeze([Object.freeze({
            stableId: request.sourceAssetId.trim(),
            outputId: request.sourceAssetId.trim(),
            recordId: request.sourceRecordId?.trim(),
          })])
          : undefined,
        parameterSummary: request.parameterSnapshot,
        outputDatasetInstance: Object.freeze({
          instanceId: outputDataset.instanceId,
          datasetAssetId: outputDataset.datasetAssetId,
          datasetAssetVersionId: outputDataset.datasetAssetVersionId,
          role: outputDataset.role,
          purpose: outputDataset.purpose,
          persistedRecordIds: Object.freeze(materialized.records.map((record) => record.recordId)),
        }),
        outputImages: Object.freeze(materialized.records.map((record) => Object.freeze({
          stableId: record.image.assetRef.stableId,
          assetId: record.image.assetRef.assetId,
          outputId: record.image.assetRef.outputId,
          recordId: record.recordId,
        }))),
        lineage: {
          status: request.runtimeContext?.selectedImages?.[0]?.assetRef?.assetId ? "complete" : "partial",
          workflowExecutionId: executionId,
          sourceImageAssetId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.assetId ?? request.sourceAssetId?.trim(),
          sourceImageRecordId: request.runtimeContext?.selectedImages?.[0]?.assetRef?.recordId ?? request.sourceRecordId?.trim(),
          sourceDatasetInstanceId: request.runtimeContext?.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store")?.instanceId,
          sourceDatasetAssetId: request.runtimeContext?.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store")?.datasetAssetId,
          workflowAssetId: request.workflowAssetId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
          workflowAssetVersionId: request.workflowAssetVersionId?.trim() || ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
          systemAssetId: request.systemAssetId?.trim() || request.runtimeContext?.runtime.systemAssetId || draft.assetId,
          systemVersionId: request.systemVersionId?.trim() || draft.lastPublishedVersionId,
          runtimeSessionId: request.runtimeContext?.runtime.runtimeSessionId,
          outputDatasetInstanceId: outputDataset.instanceId,
          outputRecordIds: Object.freeze(materialized.records.map((record) => record.recordId)),
          traceId: request.runtimeContext?.runtime.triggerEventId,
          missing: [],
        },
        timestamps: {
          requestedAt: this.now().toISOString(),
          completedAt: this.now().toISOString(),
          updatedAt: this.now().toISOString(),
        },
      });

      return Object.freeze({
        systemId: runtimeSystemId,
        datasetInstanceId: outputDataset.instanceId,
        executionId,
        materializationId: materialized.materializationId,
        persistedRecordIds: Object.freeze(materialized.records.map((record) => record.recordId)),
        status: materialized.status,
        userMessage: materialized.status === "materialized"
          ? "Done. Your new image version is ready."
          : materialized.status === "partial"
            ? "Finished with warnings. Some versions could not be saved."
            : materialized.status === "pending"
              ? "Saving is still in progress."
              : "Something went wrong while creating this image.",
        failureMessages: Object.freeze(materialized.failures.map((failure) => failure.message)),
        diagnostics: Object.freeze(materialized.failures.map((failure) => this.createReferenceImagePersistenceDiagnostic({
          stage: PersistReferenceImageOutputDiagnosticStages.outputMaterialization,
          code: failure.code,
          userMessage: failure.code === "invalid-request"
            ? "Please check your image settings and try again."
            : "Some generated outputs could not be saved.",
          technicalMessage: failure.message,
          retryable: failure.retriable,
          details: Object.freeze({
            assetIndex: failure.assetIndex,
          }),
        }))),
        executionOutcome: this.classifyReferenceImageExecutionOutcome(materialized.status),
        persistenceBlocked: materialized.status === "failed",
      });
    });
  }

  public async listReferenceImageOutputs(
    request: ListReferenceImageOutputsRequest,
  ): Promise<StudioShellApiResponse<OutputGalleryListing>> {
    return this.wrap(async () => {
      return this.listReferenceImageDatasetItemsInternal({
        studioId: request.studioId,
        draftId: request.draftId,
        datasetBindingId: "output-image-dataset",
        limit: request.limit,
        offset: request.offset,
        authorization: request.authorization,
      });
    });
  }

  public async getReferenceImageOutput(
    request: GetReferenceImageOutputRequest,
  ): Promise<StudioShellApiResponse<OutputGalleryItem>> {
    return this.wrap(async () => {
      return this.getReferenceImageDatasetItemInternal({
        studioId: request.studioId,
        draftId: request.draftId,
        datasetBindingId: "output-image-dataset",
        recordId: request.recordId,
        authorization: request.authorization,
      });
    });
  }

  public async listReferenceImageDatasetItems(
    request: ListReferenceImageDatasetItemsRequest,
  ): Promise<StudioShellApiResponse<OutputGalleryListing>> {
    return this.wrap(async () => {
      return this.listReferenceImageDatasetItemsInternal({
        studioId: request.studioId,
        draftId: request.draftId,
        datasetBindingId: request.datasetBindingId,
        limit: request.limit,
        offset: request.offset,
        authorization: request.authorization,
      });
    });
  }

  public async getReferenceImageDatasetItem(
    request: GetReferenceImageDatasetItemRequest,
  ): Promise<StudioShellApiResponse<OutputGalleryItem>> {
    return this.wrap(async () => {
      return this.getReferenceImageDatasetItemInternal(request);
    });
  }

  public async chainReferenceImageDatasetItemToInput(
    request: ChainReferenceImageDatasetItemRequest,
  ): Promise<StudioShellApiResponse<ChainReferenceImageDatasetItemReadModel>> {
    return this.wrap(async () => {
      const source = await this.resolveReferenceImageDatasetForBinding({
        studioId: request.studioId,
        draftId: request.draftId,
        datasetBindingId: request.sourceDatasetBindingId,
      });
      const targetBindingId = request.targetDatasetBindingId ?? "input-image-dataset";
      const target = await this.resolveReferenceImageDatasetForBinding({
        studioId: request.studioId,
        draftId: request.draftId,
        datasetBindingId: targetBindingId,
      });
      const sourceRecordId = request.sourceRecordId?.trim();
      if (!sourceRecordId) {
        throw new StudioShellInvalidRequestError("sourceRecordId is required.");
      }
      const sourceRecord = this.referenceImageDatasets.getImageRecordFromInstance({
        systemId: source.systemId,
        instanceId: source.instanceId,
        recordId: sourceRecordId,
      });
      if (!sourceRecord) {
        throw new StudioShellInvalidRequestError(
          `Reference image source record '${sourceRecordId}' was not found in dataset binding '${request.sourceDatasetBindingId}'.`,
        );
      }
      const targetStorageBindingArea = targetBindingId === "reference-image-dataset"
        ? "reference"
        : "input";
      const chained = await this.referenceImageDatasets.ingestImageRecordIntoInstance({
        systemId: target.systemId,
        instanceId: target.instanceId,
        storageBindingArea: targetStorageBindingArea,
        record: {
          ...sourceRecord.image,
          tags: Object.freeze([
            ...new Set([...(sourceRecord.image.tags ?? []), "chained-input"]),
          ]),
        },
        metadata: {
          ...sourceRecord.metadata,
          chainedFrom: Object.freeze({
            sourceDatasetBindingId: request.sourceDatasetBindingId,
            sourceDatasetInstanceId: source.instanceId,
            sourceRecordId,
          }),
        },
        provenance: {
          sourceType: "dataset-instance-chain",
          sourceReference: `dataset-instance:${source.instanceId}:record:${sourceRecordId}`,
          sourceSystemId: source.systemId,
          sourceRunId: sourceRecord.generation?.runId,
          ingestedBy: "studio-shell-dataset-chain",
        },
      });
      let selectedRecordId: string | undefined;
      if (targetBindingId === "input-image-dataset") {
        await this.referenceImageDatasets.selectImageRecordInInstance({
          systemId: target.systemId,
          instanceId: target.instanceId,
          recordId: chained.recordId,
          selectionContext: {
            selectionMode: "single",
            reason: "output-to-input-chain",
          },
        });
        selectedRecordId = chained.recordId;
      }
      return Object.freeze({
        systemId: target.systemId,
        source: Object.freeze({
          datasetBindingId: request.sourceDatasetBindingId,
          datasetInstanceId: source.instanceId,
          recordId: sourceRecordId,
        }),
        target: Object.freeze({
          datasetBindingId: targetBindingId,
          datasetInstanceId: target.instanceId,
          recordId: chained.recordId,
          selectedRecordId,
        }),
      });
    });
  }

  private async listReferenceImageDatasetItemsInternal(request: {
    readonly studioId: string;
    readonly draftId?: string;
    readonly datasetBindingId: ReferenceImageDatasetBindingId;
    readonly limit?: number;
    readonly offset?: number;
    readonly authorization?: ReferenceImageAccessAuthorizationContext;
  }): Promise<OutputGalleryListing> {
    const dataset = await this.resolveReferenceImageDatasetForBinding({
      studioId: request.studioId,
      draftId: request.draftId,
      datasetBindingId: request.datasetBindingId,
    });
    await this.assertReferenceImageDatasetReadAuthorized({
      systemId: dataset.systemId,
      datasetBindingId: request.datasetBindingId,
      authorization: request.authorization,
    });
    return this.referenceImageOutputGallery.listOutputGalleryItems({
      systemId: dataset.systemId,
      datasetInstanceId: dataset.instanceId,
      limit: request.limit,
      offset: request.offset,
    });
  }

  private async getReferenceImageDatasetItemInternal(
    request: {
      readonly studioId: string;
      readonly draftId?: string;
      readonly datasetBindingId: ReferenceImageDatasetBindingId;
      readonly recordId: string;
      readonly authorization?: ReferenceImageAccessAuthorizationContext;
    },
  ): Promise<OutputGalleryItem> {
    const dataset = await this.resolveReferenceImageDatasetForBinding({
      studioId: request.studioId,
      draftId: request.draftId,
      datasetBindingId: request.datasetBindingId,
    });
    await this.assertReferenceImageDatasetReadAuthorized({
      systemId: dataset.systemId,
      datasetBindingId: request.datasetBindingId,
      authorization: request.authorization,
    });
    try {
      return this.referenceImageOutputGallery.getOutputGalleryItem({
        systemId: dataset.systemId,
        datasetInstanceId: dataset.instanceId,
        recordId: request.recordId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("not-found:")) {
        throw new Error("not-found:Requested reference image output was not found.");
      }
      throw error;
    }
  }

  private async assertReferenceImageDatasetReadAuthorized(input: {
    readonly systemId: string;
    readonly datasetBindingId: ReferenceImageDatasetBindingId;
    readonly authorization?: ReferenceImageAccessAuthorizationContext;
  }): Promise<void> {
    if (!this.authorizationDecisionEvaluator) {
      return;
    }
    const actorUserIdentityId = input.authorization?.actorUserIdentityId?.trim();
    if (!actorUserIdentityId) {
      throw new Error("not-found:Requested reference image output was not found.");
    }

    const asOf = input.authorization?.asOf?.trim() || this.now().toISOString();
    const decision = await this.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: input.authorization?.activeWorkspaceId?.trim() || undefined,
        authenticatedAt: input.authorization?.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "asset.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: this.referenceImageProtectedResourceType,
          resourceId: this.createReferenceImageProtectedResourceId(input.systemId, input.datasetBindingId),
        }),
      }),
      asOf,
    });
    if (!decision.decision.isAllowed) {
      throw new Error("not-found:Requested reference image output was not found.");
    }
  }

  private createReferenceImageProtectedResourceId(systemId: string, datasetBindingId: ReferenceImageDatasetBindingId): string {
    return `${systemId.trim()}::${datasetBindingId}`;
  }

  private createReferenceImageRunProtectedResourceId(systemId: string, runId: string): string {
    return `${systemId.trim()}::${runId.trim()}`;
  }

  private async filterReferenceImageRunHistoryAuthorized(
    systemId: string,
    runs: ReadonlyArray<ImageRunHistoryListing["runs"][number]>,
    authorization?: OperationalAccessAuthorizationContext,
  ): Promise<ReadonlyArray<ImageRunHistoryListing["runs"][number]>> {
    if (!this.authorizationDecisionEvaluator) {
      return Object.freeze([...runs]);
    }
    const allowed: Array<ImageRunHistoryListing["runs"][number]> = [];
    for (const run of runs) {
      const access = await this.evaluateOperationalResourceReadAccess({
        authorization,
        requiredPermissionKey: "run.read",
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: this.referenceImageRunProtectedResourceType,
        resourceId: this.createReferenceImageRunProtectedResourceId(systemId, run.runId),
      });
      if (!access.isAllowed) {
        continue;
      }
      allowed.push(this.shapeReferenceImageRunReadModel(run, access.accessLevel));
    }
    return Object.freeze(allowed);
  }

  private async filterWorkflowRunsAuthorized(
    runs: ReadonlyArray<WorkflowRunSummaryReadModel>,
    authorization?: OperationalAccessAuthorizationContext,
  ): Promise<ReadonlyArray<WorkflowRunSummaryReadModel>> {
    if (!this.authorizationDecisionEvaluator) {
      return Object.freeze([...runs]);
    }
    const allowed: WorkflowRunSummaryReadModel[] = [];
    for (const run of runs) {
      if (await this.isOperationalResourceReadAllowed({
        authorization,
        requiredPermissionKey: "run.read",
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: this.workflowRunProtectedResourceType,
        resourceId: run.runId,
      })) {
        allowed.push(run);
      }
    }
    return Object.freeze(allowed);
  }

  private async assertWorkflowRunReadAuthorized(
    runId: string,
    authorization?: OperationalAccessAuthorizationContext,
  ): Promise<{ readonly accessLevel: AuthorizationResponseAccessLevel }> {
    if (!this.authorizationDecisionEvaluator) {
      return Object.freeze({
        accessLevel: AuthorizationResponseAccessLevels.full,
      });
    }
    const access = await this.evaluateOperationalResourceReadAccess({
      authorization,
      requiredPermissionKey: "run.read",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: this.workflowRunProtectedResourceType,
      resourceId: runId,
    });
    if (!access.isAllowed) {
      throw new Error(`not-found:Workflow run '${runId}' was not found.`);
    }
    return Object.freeze({
      accessLevel: access.accessLevel,
    });
  }

  private async isOperationalResourceReadAllowed(input: {
    readonly authorization?: OperationalAccessAuthorizationContext;
    readonly requiredPermissionKey: "run.read";
    readonly resourceFamily: typeof AuthorizationResourceFamilies.run;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<boolean> {
    const access = await this.evaluateOperationalResourceReadAccess(input);
    return access.isAllowed;
  }

  private async evaluateOperationalResourceReadAccess(input: {
    readonly authorization?: OperationalAccessAuthorizationContext;
    readonly requiredPermissionKey: "run.read";
    readonly resourceFamily: typeof AuthorizationResourceFamilies.run;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<{
    readonly isAllowed: boolean;
    readonly accessLevel: AuthorizationResponseAccessLevel;
  }> {
    if (!this.authorizationDecisionEvaluator) {
      return Object.freeze({
        isAllowed: true,
        accessLevel: AuthorizationResponseAccessLevels.full,
      });
    }
    const actorUserIdentityId = input.authorization?.actorUserIdentityId?.trim();
    if (!actorUserIdentityId) {
      return Object.freeze({
        isAllowed: false,
        accessLevel: AuthorizationResponseAccessLevels.deny,
      });
    }
    const decision = await this.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: input.authorization?.activeWorkspaceId?.trim() || undefined,
        authenticatedAt: input.authorization?.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: input.requiredPermissionKey,
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: input.resourceFamily,
          resourceType: input.resourceType,
          resourceId: input.resourceId.trim(),
        }),
      }),
      asOf: input.authorization?.asOf?.trim() || this.now().toISOString(),
    });
    return Object.freeze({
      isAllowed: decision.decision.isAllowed,
      accessLevel: deriveAuthorizationResponseAccessLevel(decision.decision),
    });
  }

  private async resolveReferenceImageDatasetForBinding(input: {
    readonly studioId: string;
    readonly draftId?: string;
    readonly datasetBindingId: ReferenceImageDatasetBindingId;
  }): Promise<{
    readonly systemId: string;
    readonly instanceId: string;
  }> {
    const { runtimeSystemId } = await this.resolveReferenceImageDraftContext({
      studioId: input.studioId,
      draftId: input.draftId,
      emptyDraftMessage: "Open a system draft to view images.",
      nonTemplateMessage: "Image datasets are only available for the reference image template.",
    });
    const includeOptionalReferenceDatasets = input.datasetBindingId === "reference-image-dataset";
    const datasets = await this.ensureReferenceImageDatasetInstances(runtimeSystemId, {
      includeOptionalReferenceDatasets,
    });
    const dataset = datasets.get(input.datasetBindingId);
    if (!dataset) {
      throw new StudioShellInvalidRequestError(`Reference image dataset binding '${input.datasetBindingId}' is unavailable.`);
    }
    return Object.freeze({
      systemId: runtimeSystemId,
      instanceId: dataset.instanceId,
    });
  }

  private async resolveReferenceImageDraftContext(input: {
    readonly studioId: string;
    readonly draftId?: string;
    readonly emptyDraftMessage: string;
    readonly nonTemplateMessage: string;
  }): Promise<{
    readonly draft: NonNullable<StudioShellSnapshotReadModel["draft"]>;
    readonly runtimeSystemId: string;
  }> {
    const snapshot = await this.requireSnapshot(input.studioId);
    const draft = snapshot.draft;
    if (!draft) {
      throw new StudioShellInvalidRequestError(input.emptyDraftMessage);
    }
    if (input.draftId?.trim() && draft.draftId !== input.draftId.trim()) {
      throw new StudioShellInvalidRequestError(`Draft '${input.draftId}' is not the active draft for studio '${input.studioId}'.`);
    }
    if (draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
      throw new StudioShellInvalidRequestError(input.nonTemplateMessage);
    }
    return Object.freeze({
      draft,
      runtimeSystemId: this.resolveReferenceRuntimeSystemId(draft),
    });
  }

  public async listReferenceImageRunHistory(
    request: ListReferenceImageRunHistoryRequest,
  ): Promise<StudioShellApiResponse<ImageRunHistoryListing>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = snapshot.draft;
      if (!draft) {
        throw new StudioShellInvalidRequestError("Open a system draft to view recent activity.");
      }
      if (request.draftId?.trim() && draft.draftId !== request.draftId.trim()) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      if (draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
        throw new StudioShellInvalidRequestError("Recent activity is only available for the reference image template.");
      }
      const runtimeSystemId = this.resolveReferenceRuntimeSystemId(draft);
      const listing = this.referenceImageRunHistory.listRuns({
        systemId: runtimeSystemId,
        workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        status: request.status,
        limit: request.limit,
        offset: request.offset,
      });
      const runs = await this.filterReferenceImageRunHistoryAuthorized(runtimeSystemId, listing.runs, request.authorization);
      if (runs.length === listing.runs.length) {
        return listing;
      }
      return Object.freeze({
        ...listing,
        summary: Object.freeze({
          ...listing.summary,
          totalRuns: runs.length,
          returnedRuns: runs.length,
          truncated: false,
        }),
        window: Object.freeze({
          ...listing.window,
          hasNextWindow: false,
        }),
        runs: Object.freeze(runs),
      });
    });
  }

  public async runDataStudioPipeline(
    request: RunDataStudioPipelineRequest,
  ): Promise<StudioShellApiResponse<RunDataStudioPipelineReadModel>> {
    return this.wrap(async () => {
      await this.requireSnapshot(request.studioId);
      const pipelineState = this.toDataStudioPipelineState(request.pipelineState);
      const runResult = await this.dataStudioPipelineExecutionService.run({
        pipelineState,
        initiatedBy: request.initiatedBy,
        executionReason: request.executionReason,
      });
      return this.toRunDataStudioPipelineReadModel(runResult);
    });
  }

  public async listDataStudioPipelines(
    request: ListDataStudioPipelinesRequest,
  ): Promise<StudioShellApiResponse<ReadonlyArray<DataStudioPipelineVersionReadModel>>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = this.requireDataStudioDraft(snapshot, request.draftId);
      const versions = await this.repository.listAssetVersionsByAssetId(draft.assetId);
      return Object.freeze(versions.map((version) => this.toDataStudioPipelineVersionReadModel(version)));
    });
  }

  public async loadDataStudioPipeline(
    request: LoadDataStudioPipelineRequest,
  ): Promise<StudioShellApiResponse<DataStudioPersistedPipelineReadModel>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = this.requireDataStudioDraft(snapshot, request.draftId);
      const versions = await this.repository.listAssetVersionsByAssetId(draft.assetId);
      const versionReadModels = Object.freeze(versions.map((version) => this.toDataStudioPipelineVersionReadModel(version)));
      const latestVersion = versions.length > 0 ? versions[versions.length - 1] : undefined;

      const source = request.source ?? (request.versionId?.trim() ? "version-id" : "draft");
      if (source === "draft") {
        return Object.freeze({
          source: "draft",
          studioId: request.studioId,
          draftId: draft.draftId,
          assetId: draft.assetId,
          selectedVersionId: draft.lastPublishedVersionId,
          latestVersionId: latestVersion?.versionId,
          pipelineState: this.toDataStudioPipelineState(draft.content),
          versions: versionReadModels,
        });
      }

      const targetVersion = source === "latest-version"
        ? latestVersion
        : versions.find((version) => version.versionId === request.versionId?.trim());
      if (!targetVersion) {
        const sourceDescription = source === "latest-version"
          ? "latest published Data Studio pipeline version"
          : `Data Studio pipeline version '${request.versionId?.trim()}'`;
        throw new StudioShellInvalidRequestError(`${sourceDescription} is not available for draft '${draft.draftId}'.`);
      }

      const parsedMetadata = parseDataStudioPipelineVersionMetadata(targetVersion.metadata);
      if (!parsedMetadata) {
        throw new StudioShellInvalidRequestError(
          `Data Studio pipeline version '${targetVersion.versionId}' does not include a persisted pipeline snapshot.`,
        );
      }

      return Object.freeze({
        source: "version",
        studioId: request.studioId,
        draftId: draft.draftId,
        assetId: draft.assetId,
        selectedVersionId: targetVersion.versionId,
        latestVersionId: latestVersion?.versionId,
        pipelineState: this.toDataStudioPipelineState(parsedMetadata.serializedPipelineState),
        versions: versionReadModels,
      });
    });
  }

  public async listWorkflowRuns(
    request: ListWorkflowStudioRunsRequest,
  ): Promise<StudioShellApiResponse<ReadonlyArray<WorkflowRunSummaryReadModel>>> {
    return this.wrap(async () => {
      if (!this.listWorkflowRunSummariesUseCase) {
        throw new StudioShellInvalidRequestError("Workflow run history integration is unavailable.");
      }

      const workflowId = request.workflowId?.trim();
      if (!workflowId) {
        throw new StudioShellInvalidRequestError("workflowId is required to list workflow runs.");
      }

      const summaries = await this.listWorkflowRunSummariesUseCase.execute({
        workflowId,
        status: request.status,
        triggerSource: request.triggerSource,
        limit: request.limit,
      });
      const readModels = summaries.map((summary) => this.toWorkflowRunSummaryReadModel(summary));
      const filtered = await this.filterWorkflowRunsAuthorized(readModels, request.authorization);
      return Object.freeze(filtered);
    });
  }

  public async getWorkflowRunDetail(
    runId: string,
    authorization?: OperationalAccessAuthorizationContext,
  ): Promise<StudioShellApiResponse<WorkflowRunDetailReadModel>> {
    return this.wrap(async () => {
      if (!this.getWorkflowRunDetailUseCase) {
        throw new StudioShellInvalidRequestError("Workflow run history integration is unavailable.");
      }

      const normalizedRunId = runId?.trim();
      if (!normalizedRunId) {
        throw new StudioShellInvalidRequestError("Workflow run id is required.");
      }
      const access = await this.assertWorkflowRunReadAuthorized(normalizedRunId, authorization);

      const detail = await this.getWorkflowRunDetailUseCase.execute(normalizedRunId);
      if (!detail) {
        throw new WorkflowPersistenceError(
          WorkflowPersistenceErrorCodes.notFound,
          `Workflow run '${normalizedRunId}' was not found.`,
        );
      }

      return this.shapeWorkflowRunDetailReadModel(
        this.toWorkflowRunDetailReadModel(detail),
        access.accessLevel,
      );
    });
  }

  public async startWorkflowRunRerun(
    request: StartWorkflowRunRerunRequest,
  ): Promise<StudioShellApiResponse<WorkflowRunRerunLaunchReadModel>> {
    return this.wrap(async () => {
      if (!this.getWorkflowRunDetailUseCase || !this.workflowRunSummaryRepository) {
        throw new StudioShellInvalidRequestError("Workflow run history integration is unavailable.");
      }
      if (!this.getPersistedWorkflowUseCase) {
        throw new StudioShellInvalidRequestError("Workflow persistence integration is unavailable.");
      }

      const sourceRunId = request.sourceRunId?.trim();
      if (!sourceRunId) {
        throw new StudioShellInvalidRequestError("sourceRunId is required.");
      }
      await this.assertWorkflowRunReadAuthorized(sourceRunId, request.authorization);

      const sourceDetail = await this.getWorkflowRunDetailUseCase.execute(sourceRunId);
      if (!sourceDetail) {
        throw new WorkflowPersistenceError(
          WorkflowPersistenceErrorCodes.notFound,
          `Workflow run '${sourceRunId}' was not found.`,
        );
      }

      const sourceExecutionInputRaw = this.assertRecord(
        sourceDetail.executionContext?.executionInput,
        "Workflow run execution context is unavailable for rerun.",
      );
      const persistedWorkflow = await this.getPersistedWorkflowUseCase.execute(sourceDetail.summary.workflow.workflowId);
      if (!persistedWorkflow) {
        throw new WorkflowPersistenceError(
          WorkflowPersistenceErrorCodes.notFound,
          `Persisted workflow '${sourceDetail.summary.workflow.workflowId}' was not found for rerun.`,
        );
      }

      const mode = request.mode === WorkflowRunRerunModes.edited
        ? WorkflowRunRerunModes.edited
        : WorkflowRunRerunModes.asIs;
      const rerunReason = request.rerunReason?.trim() || undefined;
      const baseTarget = this.toOptionalRecord(sourceExecutionInputRaw.target);
      const baseParameters = this.toOptionalRecord(sourceExecutionInputRaw.parameters) ?? Object.freeze({});
      const baseExecutionMetadata = this.toOptionalRecord(sourceExecutionInputRaw.executionMetadata);
      const basePropertyOverrides = this.toOptionalNestedRecord(sourceExecutionInputRaw.propertyOverrides);

      const overrides = request.overrides;
      const mergedTarget = overrides?.target ?? baseTarget;
      const mergedParameters = Object.freeze({
        ...baseParameters,
        ...(overrides?.parameters ?? {}),
        parentRunId: sourceRunId,
        rerunMode: mode,
        rerunReason,
      } satisfies Readonly<Record<string, unknown>>);
      const mergedExecutionMetadata = Object.freeze({
        ...(baseExecutionMetadata ?? {}),
        ...(overrides?.executionMetadata ?? {}),
      } satisfies Readonly<Record<string, unknown>>);
      const mergedPropertyOverrides = Object.freeze({
        ...(basePropertyOverrides ?? {}),
        ...(overrides?.propertyOverrides ?? {}),
      } satisfies Readonly<Record<string, Readonly<Record<string, unknown>>>>);

      const historicalTriggerContext = this.toOptionalRecord(sourceDetail.executionContext?.resolvedTriggerContext);
      const triggerActivationRecord = this.toOptionalRecord(historicalTriggerContext?.triggerActivation);
      const triggerEntry = Object.freeze({
        sourceKind: overrides?.triggerActivation?.sourceKind
          ?? this.toTriggerSourceKind(overrides?.triggerSource ?? sourceDetail.summary.triggerSource),
        triggerId: this.toOptionalString(overrides?.triggerActivation?.triggerId)
          ?? this.toOptionalString(triggerActivationRecord?.triggerId),
        triggerType: this.toOptionalString(overrides?.triggerActivation?.triggerType)
          ?? this.toOptionalString(triggerActivationRecord?.triggerType),
        activationType: this.toOptionalString(overrides?.triggerActivation?.activationType)
          ?? this.toOptionalString(triggerActivationRecord?.activationType),
        payload: this.toOptionalRecord(overrides?.triggerActivation?.payload)
          ?? this.toOptionalRecord(triggerActivationRecord?.payload),
      });

      const runResult = await this.workflowStudioService.runWorkflowDraftTriggered({
        content: persistedWorkflow.definition.serializedDraft,
        trigger: triggerEntry,
        context: {
          inputValues: this.inferInputValues(mergedParameters),
          triggerActivation: triggerEntry.triggerId
            ? {
              triggerId: triggerEntry.triggerId,
              sourceKind: triggerEntry.sourceKind,
              triggerType: triggerEntry.triggerType,
              activationType: triggerEntry.activationType,
              payload: triggerEntry.payload,
            }
            : undefined,
          metadata: mergedExecutionMetadata,
        },
      });

      const rerunRunId = this.createRerunRunId(sourceDetail.summary.workflow.workflowId);
      const rerunStepRuns = this.toWorkflowStepRuns(runResult);
      const diagnostics = this.toWorkflowExecutionDiagnostics(runResult, rerunStepRuns);
      const startedAt = runResult.executionStatus.transitions[0]?.occurredAt ?? this.now().toISOString();
      const terminalAt = runResult.executionStatus.state === WorkflowRunStatuses.running
        ? undefined
        : runResult.executionStatus.transitions[runResult.executionStatus.transitions.length - 1]?.occurredAt
          ?? this.now().toISOString();
      const status = this.toWorkflowRunStatus(runResult);

      const summary = createWorkflowRunSummaryRecord({
        runId: rerunRunId,
        status,
        triggerSource: overrides?.triggerSource ?? sourceDetail.summary.triggerSource,
        workflow: sourceDetail.summary.workflow,
        correlation: {
          executionRunId: rerunRunId,
          workflowExecutionId: runResult.executionStatus.executionId,
          executionFlowId: sourceDetail.summary.correlation.executionFlowId,
          triggerEventId: sourceDetail.summary.correlation.triggerEventId,
          parentRunId: sourceRunId,
          rerunMode: mode,
          rerunReason,
        },
        timestamps: {
          startedAt,
          endedAt: terminalAt,
          updatedAt: runResult.executionStatus.transitions[runResult.executionStatus.transitions.length - 1]?.occurredAt
            ?? this.now().toISOString(),
        },
        errorMessage: runResult.failureMessage ?? runResult.executionStatus.failure?.message,
        stepRunStats: createWorkflowStepRunStats(rerunStepRuns),
        diagnostics,
      });

      const detail = createWorkflowRunDetailRecord({
        runId: rerunRunId,
        summary,
        stepRuns: rerunStepRuns,
        diagnostics,
        executionContext: Object.freeze({
          executionInput: Object.freeze({
            target: mergedTarget,
            parameters: mergedParameters,
            executionMetadata: mergedExecutionMetadata,
            propertyOverrides: mergedPropertyOverrides,
          }),
          resolvedTriggerContext: Object.freeze({
            triggerSource: summary.triggerSource,
            triggerActivation: triggerEntry,
          }),
          runtimeContext: runResult.runtimeResult
            ? Object.freeze({
              status: runResult.runtimeResult.status,
              issueCount: runResult.runtimeResult.issues.length,
              outputDeliveryIssueCount: runResult.runtimeResult.outputDelivery.issues.length,
            })
            : undefined,
        } satisfies WorkflowRunExecutionContextRecord),
        outputs: this.toWorkflowRunOutputs(runResult),
      });

      await this.workflowRunSummaryRepository.upsertDetail(detail);

      return Object.freeze({
        sourceRunId,
        runId: rerunRunId,
        mode,
        status: summary.status,
        executionId: runResult.executionStatus.executionId,
        launchStatus: runResult.launchStatus,
        failureMessage: runResult.failureMessage ?? runResult.executionStatus.failure?.message,
      } satisfies WorkflowRunRerunLaunchReadModel);
    });
  }

  public async getPersistedWorkflow(
    workflowId: string,
  ): Promise<StudioShellApiResponse<PersistedWorkflowReadModel>> {
    return this.wrap(async () => {
      if (!this.getPersistedWorkflowUseCase) {
        throw new StudioShellInvalidRequestError("Workflow persistence integration is unavailable.");
      }

      const record = await this.getPersistedWorkflowUseCase.execute(workflowId);
      if (!record) {
        throw new WorkflowPersistenceError(
          WorkflowPersistenceErrorCodes.notFound,
          `Persisted workflow '${workflowId.trim()}' was not found.`,
        );
      }
      try {
        deserializeWorkflowDraft(record.definition.serializedDraft);
      } catch {
        throw new WorkflowPersistenceInvalidRequestError(
          `Persisted workflow '${workflowId.trim()}' contains a malformed canonical workflow definition.`,
        );
      }

      return Object.freeze({
        id: record.id,
        name: record.name,
        status: record.status,
        lifecycleState: record.lifecycleState,
        metadata: Object.freeze({
          summary: record.metadata.summary,
          tags: Object.freeze([...record.metadata.tags]),
        }),
        revision: Object.freeze({
          persistenceRevision: record.revision.persistenceRevision,
          workflowRevision: record.revision.workflowRevision,
          versionLabel: record.revision.versionLabel,
          duplicatedFromWorkflowId: record.revision.duplicatedFromWorkflowId,
        }),
        timestamps: Object.freeze({
          createdAt: record.timestamps.createdAt,
          updatedAt: record.timestamps.updatedAt,
          savedAt: record.timestamps.savedAt,
        }),
        serializedDraft: record.definition.serializedDraft,
      });
    });
  }

  private toWorkflowRunSummaryReadModel(summary: WorkflowRunSummaryRecord): WorkflowRunSummaryReadModel {
    const startedAtMs = Date.parse(summary.timestamps.startedAt);
    const endedAtMs = summary.timestamps.endedAt ? Date.parse(summary.timestamps.endedAt) : Number.NaN;
    const durationMs = Number.isFinite(startedAtMs) && Number.isFinite(endedAtMs)
      ? Math.max(0, endedAtMs - startedAtMs)
      : undefined;
    const diagnostics = this.toWorkflowRunDiagnosticReadModels(summary.diagnostics);
    const failureLocation = this.resolveFailureLocation(diagnostics);
    const hasStepFailures = (summary.stepRunStats?.failedCount ?? 0) > 0;
    const isIncomplete = summary.status === "cancelled"
      || (summary.status !== "failed" && hasStepFailures);

    return Object.freeze({
      runId: summary.runId,
      workflowId: summary.workflow.workflowId,
      workflowName: summary.workflow.workflowName,
      status: summary.status,
      triggerSource: summary.triggerSource,
      startedAt: summary.timestamps.startedAt,
      endedAt: summary.timestamps.endedAt,
      updatedAt: summary.timestamps.updatedAt,
      durationMs,
      outputCount: summary.output?.outputCount,
      errorMessage: summary.errorMessage,
      executionRunId: summary.correlation.executionRunId,
      workflowExecutionId: summary.correlation.workflowExecutionId,
      executionFlowId: summary.correlation.executionFlowId,
      triggerEventId: summary.correlation.triggerEventId,
      parentRunId: summary.correlation.parentRunId,
      rerunMode: summary.correlation.rerunMode,
      rerunReason: summary.correlation.rerunReason,
      stepRunStats: summary.stepRunStats,
      diagnostics,
      primaryDiagnostic: diagnostics?.[0],
      failureLocation,
      isIncomplete,
    } satisfies WorkflowRunSummaryReadModel);
  }

  private toWorkflowRunDetailReadModel(detail: WorkflowRunDetailRecord): WorkflowRunDetailReadModel {
    const diagnostics = this.toWorkflowRunDiagnosticReadModels(detail.diagnostics ?? detail.summary.diagnostics);
    const failureLocation = this.resolveFailureLocation(diagnostics);
    return Object.freeze({
      runId: detail.runId,
      summary: this.toWorkflowRunSummaryReadModel(detail.summary),
      stepRuns: Object.freeze([...detail.stepRuns]),
      diagnostics,
      failureLocation,
      executionContext: detail.executionContext
        ? Object.freeze({
          executionInput: detail.executionContext.executionInput,
          resolvedTriggerContext: detail.executionContext.resolvedTriggerContext,
          runtimeContext: detail.executionContext.runtimeContext,
        })
        : undefined,
      outputs: detail.outputs
        ? Object.freeze({
          outputAssetIds: Object.freeze([...detail.outputs.outputAssetIds]),
          outputCount: detail.outputs.outputCount,
          resultMessages: detail.outputs.resultMessages
            ? Object.freeze([...detail.outputs.resultMessages])
            : undefined,
          outputValues: detail.outputs.outputValues,
        })
        : undefined,
    } satisfies WorkflowRunDetailReadModel);
  }

  private shapeWorkflowRunDetailReadModel(
    value: WorkflowRunDetailReadModel,
    accessLevel: AuthorizationResponseAccessLevel,
  ): WorkflowRunDetailReadModel {
    if (accessLevel === AuthorizationResponseAccessLevels.full) {
      return value;
    }

    const shaped = shapeAuthorizationAwareResponse({
      accessLevel,
      value,
      partialRules: WorkflowRunDetailPartialRedactionRules,
    });
    return shaped.value ?? value;
  }

  private shapeReferenceImageRunReadModel(
    value: ImageRunHistoryListing["runs"][number],
    accessLevel: AuthorizationResponseAccessLevel,
  ): ImageRunHistoryListing["runs"][number] {
    if (accessLevel === AuthorizationResponseAccessLevels.full) {
      return value;
    }
    const shaped = shapeAuthorizationAwareResponse({
      accessLevel,
      value,
      partialRules: ReferenceImageRunPartialRedactionRules,
    });
    return shaped.value ?? value;
  }

  private toWorkflowRunDiagnosticReadModels(
    diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>,
  ): ReadonlyArray<WorkflowRunDiagnosticReadModel> | undefined {
    if (!diagnostics || diagnostics.length === 0) {
      return undefined;
    }

    return Object.freeze(diagnostics.map((diagnostic) => Object.freeze({
      category: diagnostic.category,
      severity: diagnostic.severity,
      scope: diagnostic.scope,
      summary: diagnostic.summary,
      code: diagnostic.code,
      technicalDetail: diagnostic.technicalDetail,
      remediationHint: diagnostic.remediationHint,
      unknownState: diagnostic.unknownState,
      location: diagnostic.location
        ? Object.freeze({ ...diagnostic.location })
        : undefined,
    } satisfies WorkflowRunDiagnosticReadModel)));
  }

  private resolveFailureLocation(
    diagnostics?: ReadonlyArray<WorkflowRunDiagnosticReadModel>,
  ): WorkflowRunFailureLocationReadModel | undefined {
    if (!diagnostics || diagnostics.length === 0) {
      return undefined;
    }

    const stepDiagnostic = diagnostics.find((diagnostic) => diagnostic.scope === WorkflowRunDiagnosticScopes.step && diagnostic.location?.stepId);
    if (stepDiagnostic?.location) {
      return Object.freeze({
        scope: "step",
        stepId: stepDiagnostic.location.stepId,
        stepRunId: stepDiagnostic.location.stepRunId,
        stepName: stepDiagnostic.location.stepName,
        stepIndex: stepDiagnostic.location.stepIndex,
      } satisfies WorkflowRunFailureLocationReadModel);
    }

    return Object.freeze({
      scope: "workflow",
    } satisfies WorkflowRunFailureLocationReadModel);
  }

  private toDataStudioPipelineState(input: DataStudioPipelineState | string): DataStudioPipelineState {
    try {
      const parsed = typeof input === "string"
        ? JSON.parse(input) as DataStudioPipelineState
        : input;
      return createDataStudioPipelineState(parsed);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "data-studio-pipeline-state-invalid";
      throw new StudioShellInvalidRequestError(`Data Studio pipeline state is invalid: ${detail}`);
    }
  }

  private toDataStudioPipelineVersionReadModel(version: AssetVersion): DataStudioPipelineVersionReadModel {
    const parsed = parseDataStudioPipelineVersionMetadata(version.metadata);
    return Object.freeze({
      versionId: version.versionId,
      versionLabel: version.versionLabel,
      parentVersionId: version.parentVersionId,
      createdAt: version.createdAt.toISOString(),
      dataStudioPipeline: parsed?.summary,
    });
  }

  private requireDataStudioDraft(
    snapshot: StudioShellSnapshotReadModel,
    explicitDraftId?: string,
  ): NonNullable<StudioShellSnapshotReadModel["draft"]> {
    const draft = snapshot.draft;
    if (!draft) {
      throw new StudioShellInvalidRequestError(`Studio '${snapshot.studioId}' does not have an active draft.`);
    }
    if (explicitDraftId?.trim() && draft.draftId !== explicitDraftId.trim()) {
      throw new StudioShellInvalidRequestError(
        `Draft '${explicitDraftId}' is not the active draft for studio '${snapshot.studioId}'.`,
      );
    }
    return draft;
  }

  private async enrichDataStudioVersionMetadataIfApplicable(
    version: AssetVersion,
    draftContent: string,
  ): Promise<void> {
    const parsedState = this.tryParseDataStudioPipelineState(draftContent);
    if (!parsedState) {
      return;
    }

    const existingMetadata = this.toOptionalRecord(version.metadata) ?? Object.freeze({});
    const enriched = new AssetVersion({
      assetId: version.assetId,
      versionId: version.versionId,
      versionLabel: version.versionLabel,
      parentVersionId: version.parentVersionId,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      contentSha256: version.contentSha256,
      contentLengthBytes: version.contentLengthBytes,
      upstreamVersionIds: version.upstreamVersionIds,
      metadata: Object.freeze({
        ...existingMetadata,
        dataStudioPipelineVersion: createDataStudioPipelineVersionMetadata(parsedState),
      }),
      reproducibilitySummary: version.reproducibilitySummary,
    });
    await this.repository.saveAssetVersion(enriched);
  }

  private tryParseDataStudioPipelineState(value: string): DataStudioPipelineState | undefined {
    try {
      return this.toDataStudioPipelineState(value);
    } catch {
      return undefined;
    }
  }

  private toDataStudioExecutionReadinessReadModel(
    readiness: DataStudioPipelineExecutionReadiness,
  ): DataStudioExecutionReadinessReadModel {
    return Object.freeze({
      ready: readiness.ready,
      executionReady: readiness.executionReady,
      blockingIssueCount: readiness.blockingIssueCount,
      warningIssueCount: readiness.warningIssueCount,
      issues: Object.freeze(readiness.issues.map((issue) => Object.freeze({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
        blocking: issue.blocking,
        scope: issue.scope,
        stageId: issue.stageId,
        relatedStageIds: issue.relatedStageIds,
        path: issue.path,
      }))),
      stageResults: Object.freeze(readiness.stageResults.map((stage) => Object.freeze({
        stageId: stage.stageId,
        ready: stage.ready,
        status: stage.status,
        blockingIssueCount: stage.blockingIssueCount,
        warningIssueCount: stage.warningIssueCount,
      }))),
    });
  }

  private toRunDataStudioPipelineReadModel(
    result: RunDataStudioPipelineResult,
  ): RunDataStudioPipelineReadModel {
    return Object.freeze({
      launchStatus: result.launchStatus,
      readiness: this.toDataStudioExecutionReadinessReadModel(result.readiness),
      execution: Object.freeze({
        runId: result.execution.runId,
        planId: result.execution.planId,
        state: result.execution.state,
        launchAccepted: result.execution.launchAccepted,
        transitions: Object.freeze(result.execution.transitions.map((transition) => Object.freeze({
          unitId: transition.unitId,
          state: transition.state,
          message: transition.message,
          occurredAt: transition.occurredAt,
        }))),
      }),
      result: result.result
        ? Object.freeze({
          pipelineId: result.result.pipelineId,
          pipelineAssetId: result.result.pipelineAssetId,
          status: result.result.status,
          stageResults: Object.freeze(result.result.stageResults.map((stage) => Object.freeze({
            stageId: stage.stageId,
            order: stage.order,
            status: stage.status,
            message: stage.message,
            resolvedAssetIds: stage.resolvedAssetIds,
            startedAt: stage.startedAt,
            completedAt: stage.completedAt,
          }))),
          preparedOutput: result.result.preparedOutput
            ? Object.freeze({
              preparedAssetId: result.result.preparedOutput.preparedAssetId,
              preparedAssetVersionId: result.result.preparedOutput.preparedAssetVersionId,
              storageTargetId: result.result.preparedOutput.storageTargetId,
              storageReference: result.result.preparedOutput.storageReference,
              lineageId: result.result.preparedOutput.lineageId,
            })
            : undefined,
          lineageId: result.result.lineageId,
          reusableAssetId: result.result.reusableAssetId,
          startedAt: result.result.startedAt,
          completedAt: result.result.completedAt,
          warnings: result.result.warnings,
          errors: result.result.errors,
        })
        : undefined,
      failureMessage: result.failureMessage,
    });
  }

  private createRerunRunId(workflowId: string): string {
    const normalized = workflowId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
    return `run:${normalized}:rerun:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private createWorkflowRunId(workflowId: string): string {
    const normalized = workflowId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
    return `run:${normalized}:manual:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private assertRecord(value: unknown, message: string): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new StudioShellInvalidRequestError(message);
    }
    return value as Readonly<Record<string, unknown>>;
  }

  private toOptionalRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Readonly<Record<string, unknown>>;
  }

  private toOptionalNestedRecord(value: unknown): Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined {
    const top = this.toOptionalRecord(value);
    if (!top) {
      return undefined;
    }

    const normalized: Record<string, Readonly<Record<string, unknown>>> = {};
    for (const [key, entry] of Object.entries(top)) {
      const record = this.toOptionalRecord(entry);
      if (record) {
        normalized[key] = record;
      }
    }
    return Object.keys(normalized).length > 0 ? Object.freeze(normalized) : undefined;
  }

  private toOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private toTriggerSourceKind(source?: WorkflowRunTriggerSource): WorkflowExecutionTriggerSourceKind {
    switch (source) {
      case "schedule":
        return WorkflowExecutionTriggerSourceKinds.temporal;
      case "event":
      case "system":
        return WorkflowExecutionTriggerSourceKinds.stateData;
      case "api":
        return WorkflowExecutionTriggerSourceKinds.manualUser;
      default:
        return WorkflowExecutionTriggerSourceKinds.manualUser;
    }
  }

  private inferInputValues(parameters: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const explicit = this.toOptionalRecord(parameters.inputValues);
    if (explicit) {
      return explicit;
    }

    const ignored = new Set([
      "triggerSource",
      "triggerEventId",
      "triggerActivation",
      "triggerContext",
      "workflowDefinitionAssetId",
      "workflowDefinitionVersionId",
      "parentRunId",
      "rerunMode",
      "rerunReason",
      "executionFlowId",
    ]);
    const inferred = Object.fromEntries(
      Object.entries(parameters).filter(([key]) => !ignored.has(key)),
    );
    return Object.freeze(inferred);
  }

  private toWorkflowRunStatus(runResult: RunWorkflowDraftManualResult): WorkflowRunStatus {
    if (runResult.executionStatus.state === WorkflowRunStatuses.completed) {
      return WorkflowRunStatuses.completed;
    }
    if (runResult.executionStatus.state === WorkflowRunStatuses.running) {
      return WorkflowRunStatuses.running;
    }
    return WorkflowRunStatuses.failed;
  }

  private toWorkflowStepRuns(runResult: RunWorkflowDraftManualResult): ReadonlyArray<WorkflowStepRunRecord> {
    if (!runResult.runtimeResult) {
      return Object.freeze([]);
    }

    const ordered = runResult.validation.plan?.orderedStepIds ?? [];
    const indexByStepId = new Map<string, number>(ordered.map((stepId, index) => [stepId, index]));
    return Object.freeze(runResult.runtimeResult.traces.map((trace, index) => {
      const status = trace.status === "completed"
        ? "completed"
        : trace.status === "skipped"
          ? "skipped"
          : trace.status === "paused"
            ? "running"
            : "failed";
      const stepIndex = indexByStepId.get(trace.stepId) ?? index;
      const updatedAt = runResult.executionStatus.transitions[runResult.executionStatus.transitions.length - 1]?.occurredAt
        ?? this.now().toISOString();
      return Object.freeze({
        stepRunId: `${runResult.executionStatus.executionId}:${trace.stepId}:${index + 1}`,
        stepId: trace.stepId,
        stepIndex,
        attempt: 1,
        stepName: trace.stepId,
        stepType: trace.elementType,
        actionType: trace.invocationSource,
        status,
        timestamps: {
          startedAt: updatedAt,
          endedAt: status === "running" ? undefined : updatedAt,
          updatedAt,
        },
        summary: trace.detail,
        error: trace.status === "failed"
          ? Object.freeze({
            message: trace.detail ?? "Step failed during rerun execution.",
          })
          : undefined,
        metadata: Object.freeze({
          loop: trace.loop,
          output: trace.output,
        }),
      } satisfies WorkflowStepRunRecord);
    }));
  }

  private toWorkflowExecutionDiagnostics(
    runResult: RunWorkflowDraftManualResult,
    stepRuns: ReadonlyArray<WorkflowStepRunRecord>,
  ): ReadonlyArray<WorkflowRunDiagnosticRecord> | undefined {
    const validationDiagnostics: WorkflowRunDiagnosticRecord[] = runResult.validation.issues
      .filter((issue) => issue.blocking || issue.severity === "warning")
      .map((issue) => Object.freeze({
        category: issue.category === "dependency"
          ? "dependency"
          : issue.category === "output-delivery"
            ? "output-delivery"
            : issue.category === "configuration"
              ? "configuration"
              : "validation",
        severity: issue.severity === "warning" ? "warning" : "error",
        scope: "workflow",
        code: issue.code,
        summary: issue.message,
      } satisfies WorkflowRunDiagnosticRecord));

    const runtimeDiagnostics: WorkflowRunDiagnosticRecord[] = runResult.runtimeResult
      ? runResult.runtimeResult.issues.map((issue) => Object.freeze({
        category: "runtime",
        severity: "error",
        scope: issue.stepId ? "step" : "workflow",
        code: issue.code,
        summary: issue.message,
        location: issue.stepId
          ? Object.freeze({
            stepId: issue.stepId,
          })
          : undefined,
      } satisfies WorkflowRunDiagnosticRecord))
      : [];

    const outputDiagnostics: WorkflowRunDiagnosticRecord[] = runResult.runtimeResult
      ? runResult.runtimeResult.outputDelivery.issues.map((issue) => Object.freeze({
        category: "output-delivery",
        severity: "error",
        scope: "workflow",
        code: issue.code,
        summary: issue.message,
      } satisfies WorkflowRunDiagnosticRecord))
      : [];

    return deriveWorkflowRunDiagnostics({
      status: this.toWorkflowRunStatus(runResult),
      errorMessage: runResult.failureMessage ?? runResult.executionStatus.failure?.message,
      stepRuns,
      existingDiagnostics: Object.freeze([
        ...validationDiagnostics,
        ...runtimeDiagnostics,
        ...outputDiagnostics,
      ]),
    });
  }

  private toWorkflowRunOutputs(runResult: RunWorkflowDraftManualResult): WorkflowRunOutputRecord | undefined {
    if (!runResult.runtimeResult) {
      return undefined;
    }

    const deliveredAssetIds = runResult.runtimeResult.outputDelivery.results
      .filter((entry) => entry.status === "delivered" && entry.persistedAssetId)
      .map((entry) => entry.persistedAssetId!);

    return Object.freeze({
      outputAssetIds: Object.freeze(deliveredAssetIds),
      outputCount: runResult.runtimeResult.outputDelivery.results.length,
      resultMessages: Object.freeze(runResult.runtimeResult.issues.map((issue) => issue.message)),
      outputValues: runResult.runtimeResult.stepOutputs,
    } satisfies WorkflowRunOutputRecord);
  }

  private toWorkflowRunTriggerSource(sourceKind?: WorkflowExecutionTriggerSourceKind): WorkflowRunTriggerSource {
    switch (sourceKind) {
      case WorkflowExecutionTriggerSourceKinds.temporal:
        return "schedule";
      case WorkflowExecutionTriggerSourceKinds.stateData:
        return "event";
      default:
        return "manual";
    }
  }

  public async duplicatePersistedWorkflow(
    request: DuplicatePersistedWorkflowRequest,
  ): Promise<StudioShellApiResponse<PersistedWorkflowReadModel>> {
    return this.wrap(async () => {
      if (!this.duplicatePersistedWorkflowUseCase) {
        throw new StudioShellInvalidRequestError("Workflow persistence integration is unavailable.");
      }

      const record = await this.duplicatePersistedWorkflowUseCase.execute(request);
      return Object.freeze({
        id: record.id,
        name: record.name,
        status: record.status,
        lifecycleState: record.lifecycleState,
        metadata: Object.freeze({
          summary: record.metadata.summary,
          tags: Object.freeze([...record.metadata.tags]),
        }),
        revision: Object.freeze({
          persistenceRevision: record.revision.persistenceRevision,
          workflowRevision: record.revision.workflowRevision,
          versionLabel: record.revision.versionLabel,
          duplicatedFromWorkflowId: record.revision.duplicatedFromWorkflowId,
        }),
        timestamps: Object.freeze({
          createdAt: record.timestamps.createdAt,
          updatedAt: record.timestamps.updatedAt,
          savedAt: record.timestamps.savedAt,
        }),
        serializedDraft: record.definition.serializedDraft,
      });
    });
  }

  private async requireSnapshot(studioId: string): Promise<StudioShellSnapshotReadModel> {
    const studio = await this.repository.getStudio(studioId.trim());
    if (!studio) {
      throw new StudioShellInvalidRequestError(`Studio '${studioId}' does not exist.`);
    }
    const activeSession = studio.activeSessionId ? await this.repository.getSession(studio.activeSessionId) : undefined;
    const activeDraft = activeSession?.currentDraftId ? await this.repository.getDraft(activeSession.currentDraftId) : undefined;
    const versions = activeDraft
      ? await this.repository.listAssetVersionsByAssetId(activeDraft.assetId)
      : Object.freeze([]);
    const validationIssues = activeDraft
      ? await buildStudioShellValidationIssues({
        draft: activeDraft,
        knownVersionIds: versions.map((entry) => entry.versionId),
        versionExists: async (versionId) => Boolean(await this.repository.getAssetVersion(versionId)),
        resolveDependencyVersion: async (versionId) => {
          const version = await this.repository.getAssetVersion(versionId);
          if (!version) {
            return undefined;
          }
          return Object.freeze({
            assetId: version.assetId.value,
            taxonomy: tryReadTaxonomyFromVersionMetadata(version.metadata),
          });
        },
      })
      : Object.freeze([]);

    return Object.freeze({
      studioId: studio.id,
      studioName: studio.name,
      activeSessionId: activeSession?.id,
      sessionStatus: activeSession?.status,
      draft: activeDraft
        ? Object.freeze({
          draftId: activeDraft.id,
          assetId: activeDraft.assetId,
          content: activeDraft.content,
          revision: activeDraft.revision,
          lifecycleStatus: activeDraft.lifecycleStatus,
          metadata: activeDraft.metadata,
          dependencies: activeDraft.dependencies,
          publishedVersionIds: activeDraft.publishedVersionIds,
          lastPublishedVersionId: activeDraft.lastPublishedVersionId,
          createdAt: activeDraft.createdAt,
          updatedAt: activeDraft.updatedAt,
        })
        : undefined,
      versions: Object.freeze(
        [...versions]
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
          .map((entry) => this.toDataStudioPipelineVersionReadModel(entry)),
      ),
      validationIssues,
    });
  }

  private async ensureReferenceImageDatasetInstances(
    systemId: string,
    options: { readonly includeOptionalReferenceDatasets?: boolean } = {},
  ): Promise<ReadonlyMap<string, Awaited<ReturnType<SystemDatasetInstanceService["ensureRoleDatasetInstance"]>>>> {
    const storage = await this.initializeReferenceImageStorage({
      systemId,
      ownerKind: "system",
      ownerRole: "reference-image-runtime",
    });
    const storageMetadata = storage.data?.storage;
    const storageBindingByArea = storageMetadata
      ? Object.freeze(Object.fromEntries(storageMetadata.bindings.map((binding) => [binding.area, Object.freeze({
        storageInstanceId: storageMetadata.instanceId,
        storageInstanceRef: storageMetadata.storageInstanceRef,
        bindingId: binding.bindingId,
        bindingReference: binding.reference,
      })])))
      : undefined;
    const requests = buildReferenceImageDatasetInstanceRequests(systemId, {
      includeOptionalReferenceDatasets: options.includeOptionalReferenceDatasets,
      storageBindingByArea,
    });
    const ensuredByBindingId = new Map<string, Awaited<ReturnType<SystemDatasetInstanceService["ensureRoleDatasetInstance"]>>>();
    for (const request of requests) {
      const ensured = await this.referenceImageDatasets.ensureRoleDatasetInstance(request as EnsureRoleDatasetInstanceRequest);
      const bindingId = request.seedMetadata?.datasetBindingId;
      if (bindingId) {
        ensuredByBindingId.set(bindingId, ensured);
      }
    }
    return ensuredByBindingId;
  }

  private async provisionReferenceImageTemplateRuntimeDefaults(studioId: string): Promise<void> {
    const snapshot = await this.requireSnapshot(studioId);
    const draft = snapshot.draft;
    if (!draft || draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
      return;
    }
    const runtimeSystemId = this.resolveReferenceRuntimeSystemId(draft);
    await this.ensureReferenceImageDatasetInstances(runtimeSystemId, {
      includeOptionalReferenceDatasets: true,
    });
  }

  public async initializeReferenceImageStorage(
    request: InitializeReferenceImageStorageRequest,
  ): Promise<StudioShellApiResponse<{ readonly storage: StorageInstanceMetadata }>> {
    return this.wrap(async () => {
      this.assertNoStoragePathConfiguration(request);
      const systemId = request.systemId.trim();
      await this.assertReferenceImageSystemOwnership(systemId);
      const ownerKind = request.ownerKind ?? "system";
      const ownerRole = request.ownerRole?.trim() || "reference-image-runtime";
      const ownerId = this.resolveStorageOwnerId({
        ownerKind,
        ownerId: request.ownerId,
        systemId,
        embeddedSubsystemId: request.embeddedSubsystemId,
      });
      const sharedAttachment = request.attachToStorageInstanceId?.trim();
      const explicitInstanceId = request.storageInstanceId?.trim() || `storage-instance:${systemId}:image-runtime`;
      const initialized = await this.storageInitialization.initialize({
        strategy: sharedAttachment ? "attach" : "provision",
        instanceId: explicitInstanceId,
        attachInstanceId: sharedAttachment,
        owner: {
          ownerKind,
          ownerId,
          role: ownerRole,
        },
        requestedBindings: ["input", "output", "reference", "intermediate"],
        display: {
          name: "Reference image runtime storage",
          summary: "Reusable runtime storage instance for image manipulation input/output/intermediate areas.",
          tags: ["reference-image", ownerKind],
        },
        metadata: {
          systemId,
          ownerKind,
        },
      });
      return Object.freeze({
        storage: initialized.metadata,
      });
    });
  }

  public async manageReferenceImageStorageLifecycle(
    request: ManageReferenceImageStorageLifecycleRequest,
  ): Promise<StudioShellApiResponse<ManageReferenceImageStorageLifecycleReadModel>> {
    return this.wrap(async () => {
      const systemId = request.systemId.trim();
      await this.assertReferenceImageSystemOwnership(systemId);
      const instanceId = request.storageInstanceId.trim();
      const operation = request.operation;
      const boundBefore = this.listReferenceImageDatasetInstancesBoundToStorage(systemId, instanceId);

      const storage = operation === "initialize"
        ? await this.storageLifecycle.initialize(instanceId)
        : operation === "reset"
          ? await this.storageLifecycle.reset(instanceId)
          : operation === "archive"
            ? await this.storageLifecycle.archive(instanceId)
            : operation === "cleanup"
              ? await this.storageLifecycle.cleanup(instanceId)
              : await this.storageLifecycle.inspect(instanceId);

      if (operation === "reset") {
        for (const dataset of boundBefore) {
          await this.referenceImageDatasets.resetDatasetInstanceState({
            systemId,
            instanceId: dataset.instanceId,
          });
        }
      } else if (operation === "archive") {
        for (const dataset of boundBefore) {
          await this.referenceImageDatasets.archiveDatasetInstance({
            systemId,
            instanceId: dataset.instanceId,
            cleanupStatus: "pending",
          });
        }
      } else if (operation === "cleanup") {
        for (const dataset of boundBefore) {
          if (dataset.lifecycleStatus !== "archived") {
            continue;
          }
          await this.referenceImageDatasets.archiveDatasetInstance({
            systemId,
            instanceId: dataset.instanceId,
            cleanupStatus: "completed",
          });
        }
      }

      const boundAfter = this.listReferenceImageDatasetInstancesBoundToStorage(systemId, instanceId);
      return Object.freeze({
        operation,
        storage,
        datasets: Object.freeze(boundAfter.map((dataset) => this.summarizeReferenceImageStorageDataset(systemId, dataset))),
      });
    });
  }

  public async deleteReferenceImageStorage(
    request: DeleteReferenceImageStorageRequest,
  ): Promise<StudioShellApiResponse<{ readonly instanceId: string; readonly deleted: boolean }>> {
    return this.wrap(async () => {
      const systemId = request.systemId.trim();
      await this.assertReferenceImageSystemOwnership(systemId);
      const deleted = await this.storageLifecycle.safeDelete(request.storageInstanceId.trim());
      return Object.freeze(deleted);
    });
  }

  private resolveStorageOwnerId(input: {
    readonly ownerKind: StorageAttachmentOwnerKind;
    readonly ownerId?: string;
    readonly systemId: string;
    readonly embeddedSubsystemId?: string;
  }): string {
    const explicitOwnerId = input.ownerId?.trim();
    if (explicitOwnerId) {
      return explicitOwnerId;
    }
    if (input.ownerKind === "embedded-subsystem") {
      const subsystemId = input.embeddedSubsystemId?.trim();
      if (!subsystemId) {
        throw new StudioShellInvalidRequestError(
          "embeddedSubsystemId is required when ownerKind is 'embedded-subsystem' unless ownerId is provided.",
        );
      }
      return `${input.systemId}::subsystem:${subsystemId}`;
    }
    return input.systemId;
  }

  private assertNoStoragePathConfiguration(input: unknown): void {
    try {
      assertNoUserManagedStoragePaths(
        input,
        "Storage path configuration is infrastructure-owned and cannot be provided by initialization callers.",
      );
    } catch (error) {
      throw new StudioShellInvalidRequestError((error as Error).message);
    }
  }

  private listReferenceImageDatasetInstancesBoundToStorage(
    systemId: string,
    storageInstanceId: string,
  ): ReadonlyArray<DatasetInstance> {
    return Object.freeze(this.referenceImageDatasets
      .listSystemDatasetInstances(systemId)
      .filter((instance) =>
        instance.storageBindings?.some((binding) => binding.storageInstanceId === storageInstanceId)
        || instance.storageBinding?.storageInstanceId === storageInstanceId
      ));
  }

  private summarizeReferenceImageStorageDataset(
    systemId: string,
    instance: DatasetInstance,
  ): ReferenceImageStorageLifecycleDatasetSummary {
    const imageRecordCount = this.referenceImageDatasets.listImageRecordsForInstance({
      systemId,
      instanceId: instance.instanceId,
    }).length;
    const storageBindingAreas = instance.storageBindings?.map((binding) => binding.bindingArea)
      ?? (instance.storageBinding ? [instance.storageBinding.bindingArea] : []);
    const seedMetadata = this.toOptionalRecord(instance.seedMetadata);
    const datasetBindingId = typeof seedMetadata?.datasetBindingId === "string"
      ? seedMetadata.datasetBindingId
      : undefined;
    return Object.freeze({
      datasetBindingId,
      instanceId: instance.instanceId,
      lifecycleStatus: instance.lifecycleStatus,
      runtimeStatus: instance.runtimeStatus,
      cleanupStatus: instance.lifecycleMetadata?.cleanupStatus,
      imageRecordCount,
      storageBindingAreas: Object.freeze([...new Set(storageBindingAreas)]),
    });
  }

  private async assertReferenceImageSystemOwnership(systemId: string): Promise<void> {
    if (systemId === ReferenceImageSystemTemplate.systemAsset.assetId || systemId.startsWith("system:studio:")) {
      return;
    }
    throw new Error(`not-found:System '${systemId}' is not available for reference image dataset ownership.`);
  }

  private resolveReferenceRuntimeSystemId(draft: StudioShellSnapshotReadModel["draft"]): string {
    if (draft?.assetId?.startsWith("system:")) {
      return draft.assetId;
    }
    return `system:studio:${draft?.draftId ?? "unknown"}`;
  }

  private decodeBase64Payload(value: string): Uint8Array {
    const normalized = value.trim();
    if (!normalized) {
      throw new StudioShellInvalidRequestError("Uploaded file payload is required.");
    }
    try {
      return Uint8Array.from(Buffer.from(normalized, "base64"));
    } catch {
      throw new StudioShellInvalidRequestError("Uploaded file payload could not be decoded.");
    }
  }

  private async materializeUploadedImagePayload(input: {
    readonly payload: Uint8Array;
    readonly fileName: string;
    readonly systemId: string;
    readonly datasetBindingId: ReferenceImageDatasetBindingId;
  }): Promise<string> {
    const nodeRuntime = await this.resolveNodeUploadRuntime();
    const safeFileName = this.sanitizeUploadFileName(input.fileName);
    const safeSystemId = input.systemId.replace(/[^a-z0-9-_.:]/gi, "_");
    const safeBindingId = input.datasetBindingId.replace(/[^a-z0-9-_.:]/gi, "_");
    const now = this.now();
    const stamp = [
      now.getUTCFullYear().toString().padStart(4, "0"),
      (now.getUTCMonth() + 1).toString().padStart(2, "0"),
      now.getUTCDate().toString().padStart(2, "0"),
      "-",
      now.getUTCHours().toString().padStart(2, "0"),
      now.getUTCMinutes().toString().padStart(2, "0"),
      now.getUTCSeconds().toString().padStart(2, "0"),
      "-",
      now.getUTCMilliseconds().toString().padStart(3, "0"),
    ].join("");
    const unique = Math.random().toString(36).slice(2, 10);
    const root = nodeRuntime.path.join(
      nodeRuntime.os.tmpdir(),
      "ai-loom-studio",
      "reference-image-uploads",
      safeSystemId,
      safeBindingId,
    );
    await nodeRuntime.fs.mkdir(root, { recursive: true });
    const filePath = nodeRuntime.path.join(root, `${stamp}-${unique}-${safeFileName}`);
    await nodeRuntime.fs.writeFile(filePath, Buffer.from(input.payload));
    return filePath;
  }

  private sanitizeUploadFileName(fileName: string): string {
    const trimmed = fileName.trim();
    if (!trimmed) {
      return "upload.bin";
    }
    const baseName = (trimmed
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-z0-9-_.]/gi, "_")) ?? "";
    return baseName.length > 0 ? baseName : "upload.bin";
  }

  private async resolveNodeUploadRuntime(): Promise<{
    readonly fs: {
      readonly mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
      readonly writeFile: (file: string, data: Uint8Array) => Promise<void>;
    };
    readonly os: { readonly tmpdir: () => string };
    readonly path: { readonly join: (...parts: ReadonlyArray<string>) => string };
  }> {
    try {
      const [fsModule, osModule, pathModule] = await Promise.all([
        import("node:fs"),
        import("node:os"),
        import("node:path"),
      ]);
      if (!fsModule.promises?.mkdir || !fsModule.promises?.writeFile) {
        throw new Error("Node fs.promises APIs are unavailable.");
      }
      return Object.freeze({
        fs: fsModule.promises,
        os: osModule.default,
        path: pathModule.default,
      });
    } catch (error) {
      throw new StudioShellInvalidRequestError(
        `Image upload caching requires a Node.js filesystem runtime (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }

  private extractComfyResultFromRuntimeResult(
    runtimeOutput: unknown,
  ): {
    readonly executionId: string;
    readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
    readonly outputs: ReadonlyArray<{
      readonly nodeId: string;
      readonly kind: "image" | "text" | "binary" | "json";
      readonly reference: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly assetRef?: {
        readonly assetId?: string;
        readonly versionId?: string;
      };
    }>;
    readonly lifecycle: ReadonlyArray<{
      readonly at: string;
      readonly state: "queued" | "running" | "completed" | "failed" | "cancelled";
      readonly message?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    }>;
  } | undefined {
    const root = this.toOptionalRecord(runtimeOutput);
    const direct = root && this.tryReadComfyResult(root);
    if (direct) {
      return direct;
    }
    const payload = root && this.toOptionalRecord(root.payload);
    const fromPayload = payload && this.tryReadComfyResult(payload);
    if (fromPayload) {
      return fromPayload;
    }
    const nodeResults = payload && this.toOptionalRecord(payload.nodeResults);
    if (!nodeResults) {
      return undefined;
    }

    for (const value of Object.values(nodeResults)) {
      const candidate = this.toOptionalRecord(value);
      if (!candidate) {
        continue;
      }
      const nested = this.tryReadComfyResult(candidate);
      if (nested) {
        return nested;
      }
      const nestedResult = this.toOptionalRecord(candidate.result);
      if (nestedResult) {
        const extracted = this.tryReadComfyResult(nestedResult);
        if (extracted) {
          return extracted;
        }
      }
    }
    return undefined;
  }

  private normalizeRuntimeExecutionStatus(status: unknown): "queued" | "running" | "completed" | "failed" | "cancelled" | undefined {
    if (typeof status !== "string") {
      return undefined;
    }
    const normalized = status.trim().toLowerCase();
    if (normalized === "queued" || normalized === "pending" || normalized === "accepted") {
      return "queued";
    }
    if (normalized === "running" || normalized === "in-progress") {
      return "running";
    }
    if (normalized === "completed" || normalized === "succeeded" || normalized === "success") {
      return "completed";
    }
    if (normalized === "failed" || normalized === "error") {
      return "failed";
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return "cancelled";
    }
    return undefined;
  }

  private classifyReferenceImageExecutionOutcome(
    status: PersistReferenceImageOutputsReadModel["status"],
  ): PersistReferenceImageOutputsReadModel["executionOutcome"] {
    if (status === "materialized") {
      return "success";
    }
    if (status === "partial") {
      return "partial-failure";
    }
    if (status === "failed") {
      return "recoverable-failure";
    }
    return "recoverable-failure";
  }

  private createReferenceImagePersistenceDiagnostic(
    input: PersistReferenceImageOutputDiagnostic,
  ): PersistReferenceImageOutputDiagnostic {
    return Object.freeze({
      stage: input.stage,
      code: input.code.trim(),
      userMessage: input.userMessage.trim(),
      technicalMessage: input.technicalMessage?.trim(),
      retryable: input.retryable,
      details: input.details ? Object.freeze({ ...input.details }) : undefined,
    });
  }

  private classifyExecutionFailureStage(
    diagnostics?: ReadonlyArray<{
      readonly source?: string;
      readonly severity?: "info" | "warning" | "error";
      readonly code?: string;
      readonly message?: string;
      readonly nodeId?: string;
      readonly at?: string;
    }>,
  ): PersistReferenceImageOutputDiagnosticStage {
    const firstMessage = diagnostics?.[0]?.message?.toLowerCase() ?? "";
    const firstCode = diagnostics?.[0]?.code?.toLowerCase() ?? "";
    const merged = `${firstCode} ${firstMessage}`;
    if (
      merged.includes("model")
      || merged.includes("checkpoint")
      || merged.includes("vae")
      || merged.includes("dependency")
      || merged.includes("missing-node")
      || merged.includes("missing node")
    ) {
      return PersistReferenceImageOutputDiagnosticStages.modelDependencyAvailability;
    }
    return PersistReferenceImageOutputDiagnosticStages.executionSubmission;
  }

  private createRuntimeDiagnosticDetail(
    diagnostics?: ReadonlyArray<{
      readonly source?: string;
      readonly severity?: "info" | "warning" | "error";
      readonly code?: string;
      readonly message?: string;
      readonly nodeId?: string;
      readonly at?: string;
    }>,
  ): Readonly<Record<string, unknown>> | undefined {
    if (!diagnostics || diagnostics.length === 0) {
      return undefined;
    }
    return Object.freeze({
      runtimeDiagnostics: Object.freeze(diagnostics.map((entry) => Object.freeze({
        source: entry.source,
        severity: entry.severity,
        code: entry.code,
        message: entry.message,
        nodeId: entry.nodeId,
        at: entry.at,
      }))),
    });
  }

  private tryReadComfyResult(
    candidate: Readonly<Record<string, unknown>>,
  ): {
    readonly executionId: string;
    readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
    readonly outputs: ReadonlyArray<{
      readonly nodeId: string;
      readonly kind: "image" | "text" | "binary" | "json";
      readonly reference: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly assetRef?: {
        readonly assetId?: string;
        readonly versionId?: string;
      };
    }>;
    readonly lifecycle: ReadonlyArray<{
      readonly at: string;
      readonly state: "queued" | "running" | "completed" | "failed" | "cancelled";
      readonly message?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    }>;
  } | undefined {
    const outputsRaw = Array.isArray(candidate.outputs) ? candidate.outputs : undefined;
    const executionId = typeof candidate.executionId === "string"
      ? candidate.executionId.trim()
      : "";
    const statusRaw = typeof candidate.status === "string" ? candidate.status.trim() : "";
    if (!outputsRaw || !executionId) {
      return undefined;
    }
    if (!["queued", "running", "completed", "failed", "cancelled"].includes(statusRaw)) {
      return undefined;
    }
    return Object.freeze({
      executionId,
      status: statusRaw as "queued" | "running" | "completed" | "failed" | "cancelled",
      outputs: Object.freeze(outputsRaw
        .map((entry) => this.toOptionalRecord(entry))
        .filter((entry): entry is Readonly<Record<string, unknown>> => Boolean(entry))
        .map((entry) => Object.freeze({
          nodeId: typeof entry.nodeId === "string" && entry.nodeId.trim()
            ? entry.nodeId.trim()
            : "node",
          kind: entry.kind === "image" || entry.kind === "text" || entry.kind === "binary" || entry.kind === "json"
            ? entry.kind
            : "json",
          reference: typeof entry.reference === "string" && entry.reference.trim()
            ? entry.reference.trim()
            : `${executionId}:output`,
          metadata: this.toOptionalRecord(entry.metadata),
          assetRef: this.toOptionalRecord(entry.assetRef)
            ? Object.freeze({
              assetId: typeof this.toOptionalRecord(entry.assetRef)?.assetId === "string"
                ? String(this.toOptionalRecord(entry.assetRef)?.assetId)
                : undefined,
              versionId: typeof this.toOptionalRecord(entry.assetRef)?.versionId === "string"
                ? String(this.toOptionalRecord(entry.assetRef)?.versionId)
                : undefined,
            })
            : undefined,
        }))),
      lifecycle: Object.freeze([]),
    });
  }

  private deriveFileFormat(fileName: string, mimeType?: string): string {
    const mime = mimeType?.trim().toLowerCase();
    if (mime && mime.includes("/")) {
      return mime.split("/")[1] || "png";
    }
    const dot = fileName.lastIndexOf(".");
    if (dot > -1 && dot < fileName.length - 1) {
      return fileName.slice(dot + 1).toLowerCase();
    }
    return "png";
  }

  private toImageWorkflowSummaryReadModel(
    template: InitialImageWorkflowTemplateDefinition,
    updatedAt: string,
  ): StudioImageWorkflowDefinitionSummaryReadModel {
    const versionTag = template.templateFamilyId.split(":").at(-1) ?? "v1";
    const lineageId = template.templateFamilyId.replace(/:v\d+$/i, "");
    return Object.freeze({
      workflowId: template.templateFamilyId,
      title: template.display.title,
      summary: template.display.summary,
      operationKind: template.operationKind,
      version: Object.freeze({
        lineageId,
        versionTag,
        revision: 1,
      }),
      updatedAt,
    });
  }

  private toImageWorkflowDefinitionReadModel(
    template: InitialImageWorkflowTemplateDefinition,
    updatedAt: string,
  ): StudioImageWorkflowDefinitionReadModel {
    const parameterSpecifications = Object.freeze(this.toImageWorkflowParameterSpecifications(template));
    const requiredParameterIds = template.minimumRequirements.parameterSpecifications
      .filter((entry) => entry.required)
      .map((entry) => entry.parameterId);
    const summary = this.toImageWorkflowSummaryReadModel(template, updatedAt);
    return Object.freeze({
      ...summary,
      rationale: template.display.rationale,
      parameterSpecifications,
      parameterDefaults: Object.freeze({ ...template.configuration.defaults.parameterValues }),
      minimumRequirements: Object.freeze({
        inputKinds: Object.freeze([...new Set(template.minimumRequirements.inputSlots
          .filter((entry) => entry.required)
          .map((entry) => entry.kind))]),
        outputKinds: Object.freeze([...new Set(template.minimumRequirements.outputExpectations
          .filter((entry) => entry.required)
          .map((entry) => entry.kind))]),
        requiredParameterIds: Object.freeze(requiredParameterIds),
      }),
    });
  }

  private toImageWorkflowParameterSpecifications(
    template: InitialImageWorkflowTemplateDefinition,
  ): ReadonlyArray<ImageWorkflowParameterSpecification> {
    const guidanceByParameterId = new Map(
      template.configuration.parameterGuidance.map((entry) => [entry.parameterId, entry] as const),
    );
    const defaults = template.configuration.defaults.parameterValues;

    return template.minimumRequirements.parameterSpecifications.map((parameter, index) => {
      const guidance = guidanceByParameterId.get(parameter.parameterId);
      const isNumeric = parameter.valueKind === "integer" || parameter.valueKind === "float";
      const validation = Object.freeze({
        minimum: isNumeric
          ? guidance?.guardrails?.minimum ?? guidance?.recommendedRange?.minimum
          : undefined,
        maximum: isNumeric
          ? guidance?.guardrails?.maximum ?? guidance?.recommendedRange?.maximum
          : undefined,
        step: isNumeric
          ? guidance?.recommendedRange?.step
          : undefined,
        minLength: parameter.valueKind === "text"
          ? guidance?.guardrails?.minLength ?? guidance?.recommendedRange?.minLength
          : undefined,
        maxLength: parameter.valueKind === "text"
          ? guidance?.guardrails?.maxLength ?? guidance?.recommendedRange?.maxLength
          : undefined,
        options: parameter.valueKind === "select"
          ? Object.freeze(
            (guidance?.guardrails?.allowedValues ?? guidance?.recommendedRange?.suggestedValues ?? [])
              .map((entry) => (typeof entry === "string" ? entry : undefined))
              .filter((entry): entry is string => Boolean(entry))
              .map((entry) => Object.freeze({ value: entry, label: entry })),
          )
          : undefined,
        acceptedAssetKinds: undefined,
      });
      const control = parameter.valueKind === "boolean"
        ? ImageWorkflowParameterUiControlKinds.switch
        : parameter.valueKind === "text"
          ? parameter.semanticMeaning === "prompt"
            ? ImageWorkflowParameterUiControlKinds.textArea
            : ImageWorkflowParameterUiControlKinds.textInput
          : parameter.valueKind === "integer" || parameter.valueKind === "float"
            ? guidance?.recommendedRange?.minimum !== undefined || guidance?.recommendedRange?.maximum !== undefined
              ? ImageWorkflowParameterUiControlKinds.slider
              : ImageWorkflowParameterUiControlKinds.numberInput
            : parameter.valueKind === "select"
              ? ImageWorkflowParameterUiControlKinds.select
              : parameter.valueKind === "mask-asset-reference"
                ? ImageWorkflowParameterUiControlKinds.maskSlot
                : parameter.valueKind === "reference-asset-reference"
                  ? ImageWorkflowParameterUiControlKinds.referenceSlot
                  : ImageWorkflowParameterUiControlKinds.assetPicker;

      return normalizeImageWorkflowParameterSpecification({
        parameterId: parameter.parameterId,
        label: guidance?.label ?? parameter.parameterId,
        description: guidance?.helperText,
        valueKind: parameter.valueKind,
        semanticMeaning: parameter.semanticMeaning,
        required: parameter.required,
        defaultValue: defaults[parameter.parameterId],
        sensitivity: ImageWorkflowParameterSensitivityLevels.normal,
        validation,
        ui: {
          control,
          placeholder: parameter.valueKind === "text" && typeof defaults[parameter.parameterId] === "string"
            ? String(defaults[parameter.parameterId])
            : undefined,
          order: index,
          helpText: guidance?.helperText,
          advanced: false,
        },
      });
    });
  }

  private toImageSystemDefinitionListingReadModel(
    result: ListImageSystemDefinitionsResult,
  ): StudioImageSystemDefinitionListingReadModel {
    return Object.freeze({
      items: Object.freeze(result.items.map((entry) => {
        const readiness = this.toImageSystemReadinessReadModel(entry.readiness);
        return Object.freeze({
          systemId: entry.systemId,
          title: entry.title,
          summary: entry.summary,
          lifecycleState: entry.lifecycleState,
          runtimeStatus: entry.runtimeStatus,
          workflowId: entry.workflowBinding.workflowId,
          workflowVersionTag: entry.workflowBinding.workflowVersionTag,
          readinessState: entry.readiness.state,
          readinessSummary: entry.readiness.summary,
          readiness,
          updatedAt: entry.updatedAt,
        });
      })),
      pagination: Object.freeze({
        ...result.pagination,
      }),
    });
  }

  private toImageSystemDefinitionReadModel(
    result: ImageSystemDefinitionDetailResult | {
      readonly system: ImageSystemDefinitionDetailResult["system"];
      readonly readiness: ImageSystemDefinitionDetailResult["readiness"];
      readonly validation?: {
        readonly issues: ReadonlyArray<{
          readonly code: string;
          readonly path: string;
          readonly message: string;
          readonly severity: "error" | "warning" | "info";
        }>;
      };
      readonly compatibility?: {
        readonly issues: ReadonlyArray<{
          readonly code: string;
          readonly path: string;
          readonly message: string;
          readonly severity: "error" | "warning" | "info";
        }>;
      };
    },
  ): StudioImageSystemDefinitionReadModel {
    const readiness = this.toImageSystemReadinessReadModel(result.readiness, {
      validationIssues: result.validation?.issues,
      compatibilityIssues: result.compatibility?.issues,
    });

    return Object.freeze({
      systemId: result.system.systemId,
      title: result.system.display.title,
      summary: result.system.display.summary,
      lifecycleState: result.system.lifecycleState,
      runtimeStatus: result.system.runtimeStatus,
      workflowId: result.system.workflowBinding.workflowId,
      workflowVersionTag: result.system.workflowBinding.workflowVersionTag,
      readinessState: result.readiness.state,
      readinessSummary: result.readiness.summary,
      readiness,
      updatedAt: result.system.updatedAt,
      parameterBaseline: Object.freeze({ ...result.system.parameterBaseline.values }),
      outputTargetBindings: Object.freeze(result.system.outputTargetBindings.map((entry) => Object.freeze({
        outputId: entry.outputId,
        targetReference: entry.targetReference,
      }))),
    });
  }

  private toImageSystemReadinessReadModel(
    readiness: {
      readonly state: string;
      readonly summary: string;
      readonly runnable?: boolean;
      readonly issues: ReadonlyArray<{
        readonly code: string;
        readonly path?: string;
        readonly message: string;
      }>;
    },
    input: {
      readonly validationIssues?: ReadonlyArray<{
        readonly code: string;
        readonly path: string;
        readonly message: string;
        readonly severity: "error" | "warning" | "info";
      }>;
      readonly compatibilityIssues?: ReadonlyArray<{
        readonly code: string;
        readonly path: string;
        readonly message: string;
        readonly severity: "error" | "warning" | "info";
      }>;
    } = {},
  ): StudioImageSystemReadinessReadModel {
    const blockingIssues = readiness.state === "configuration-incomplete"
      ? readiness.issues.map((issue) => Object.freeze({
        code: issue.code,
        path: issue.path,
        message: issue.message,
        severity: "blocking" as const,
      }))
      : [];

    const advisoryIssues = [
      ...this.toAdvisoryIssuesFromValidation(input.validationIssues),
      ...this.toAdvisoryIssuesFromValidation(input.compatibilityIssues),
      ...(readiness.state === "configuration-ready" && readiness.runnable !== true
        ? [Object.freeze({
          code: "system-ready-not-runnable-yet",
          path: "runtimeStatus",
          message: "This setup is complete, but it still needs runtime enablement before launch.",
          severity: "advisory" as const,
        })]
        : []),
    ];

    return Object.freeze({
      state: readiness.state,
      summary: readiness.summary,
      blockingIssueCount: blockingIssues.length,
      advisoryIssueCount: advisoryIssues.length,
      blockingIssues: Object.freeze(blockingIssues),
      advisoryIssues: Object.freeze(advisoryIssues),
    });
  }

  private toAdvisoryIssuesFromValidation(
    issues: ReadonlyArray<{
      readonly code: string;
      readonly path: string;
      readonly message: string;
      readonly severity: "error" | "warning" | "info";
    }> | undefined,
  ): ReadonlyArray<StudioImageSystemReadinessIssueReadModel> {
    if (!issues || issues.length < 1) {
      return Object.freeze([]);
    }
    return Object.freeze(issues
      .filter((issue) => issue.severity !== "error")
      .map((issue) => Object.freeze({
        code: issue.code,
        path: issue.path,
        message: issue.message,
        severity: "advisory" as const,
      })));
  }

  private readStudioImageSystemDraftState(content: string): {
    readonly imageSystemDefinitionId?: string;
    readonly workflowAssetId?: string;
    readonly workflowVersionTag?: string;
    readonly datasetInstanceId?: string;
    readonly workflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  } {
    try {
      const parsed = JSON.parse(content) as {
        readonly systemSpec?: {
          readonly serialization?: {
            readonly runtime?: {
              readonly workflowBindings?: ReadonlyArray<{
                readonly workflowAssetId?: string;
                readonly workflowVersionId?: string;
              }>;
              readonly datasetInstances?: ReadonlyArray<{
                readonly instanceId?: string;
              }>;
              readonly state?: {
                readonly imageWorkflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
                readonly imageSystemDefinitionId?: string;
              };
            };
          };
        };
      };
      const firstWorkflowBinding = parsed.systemSpec?.serialization?.runtime?.workflowBindings?.[0];
      const firstDatasetInstance = parsed.systemSpec?.serialization?.runtime?.datasetInstances?.[0];
      return Object.freeze({
        imageSystemDefinitionId: parsed.systemSpec?.serialization?.runtime?.state?.imageSystemDefinitionId,
        workflowAssetId: firstWorkflowBinding?.workflowAssetId?.trim(),
        workflowVersionTag: firstWorkflowBinding?.workflowVersionId?.trim(),
        datasetInstanceId: firstDatasetInstance?.instanceId?.trim(),
        workflowParameterValuesByWorkflowId: parsed.systemSpec?.serialization?.runtime?.state?.imageWorkflowParameterValuesByWorkflowId,
      });
    } catch {
      return Object.freeze({});
    }
  }

  private writeStudioImageSystemDraftState(
    content: string,
    patch: {
      readonly imageSystemDefinitionId: string;
      readonly workflowAssetId: string;
      readonly workflowVersionTag?: string;
      readonly workflowParameterValuesByWorkflowId: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    },
  ): string {
    const root = content.trim()
      ? (JSON.parse(content) as Record<string, unknown>)
      : {};
    const systemSpec = (
      root.systemSpec
      && typeof root.systemSpec === "object"
      && !Array.isArray(root.systemSpec)
    )
      ? { ...(root.systemSpec as Record<string, unknown>) }
      : {};
    const serialization = (
      systemSpec.serialization
      && typeof systemSpec.serialization === "object"
      && !Array.isArray(systemSpec.serialization)
    )
      ? { ...(systemSpec.serialization as Record<string, unknown>) }
      : {};
    const runtime = (
      serialization.runtime
      && typeof serialization.runtime === "object"
      && !Array.isArray(serialization.runtime)
    )
      ? { ...(serialization.runtime as Record<string, unknown>) }
      : {};
    const state = (
      runtime.state
      && typeof runtime.state === "object"
      && !Array.isArray(runtime.state)
    )
      ? { ...(runtime.state as Record<string, unknown>) }
      : {};

    runtime.workflowBindings = Object.freeze([Object.freeze({
      bindingId: "component:primary",
      workflowAssetId: patch.workflowAssetId,
      workflowVersionId: patch.workflowVersionTag,
    })]);
    state.imageSystemDefinitionId = patch.imageSystemDefinitionId;
    state.imageWorkflowParameterValuesByWorkflowId = patch.workflowParameterValuesByWorkflowId;
    runtime.state = state;
    serialization.runtime = runtime;
    systemSpec.serialization = serialization;
    root.systemSpec = systemSpec;

    return JSON.stringify(root, null, 2);
  }

  private async synchronizeWorkflowPersistenceFromStudioDraft(
    studioId: string,
    explicitDraftId?: string,
  ): Promise<void> {
    if (!this.createPersistedWorkflow || !this.updatePersistedWorkflow || !this.getPersistedWorkflowUseCase) {
      return;
    }

    const studio = await this.repository.getStudio(studioId.trim());
    if (!studio) {
      return;
    }

    const resolvedDraftId = explicitDraftId?.trim()
      || (studio.activeSessionId ? (await this.repository.getSession(studio.activeSessionId))?.currentDraftId : undefined);
    if (!resolvedDraftId) {
      return;
    }

    const draft = await this.repository.getDraft(resolvedDraftId);
    if (!draft) {
      return;
    }

    const taxonomy = draft.metadata.taxonomy;
    if (taxonomy?.structuralKind !== "composite" || taxonomy.semanticRole !== "workflow") {
      return;
    }

    const canonicalDraft = deserializeWorkflowDraft(draft.content);
    const persistedWorkflowId = draft.assetId;
    const ownershipContext = Object.freeze({
      ownerId: draft.metadata.provenance?.creatorId,
      studioId: draft.studioId,
      sessionId: draft.sessionId,
    });
    const lifecycleState = draft.lifecycleStatus === AssetDraftLifecycleStatuses.draft
      ? WorkflowLifecycleStates.draft
      : WorkflowLifecycleStates.saved;
    const metadata = Object.freeze({
      summary: draft.metadata.summary,
      tags: draft.metadata.tags,
    });

    const existing = await this.getPersistedWorkflowUseCase.execute(persistedWorkflowId);
    if (!existing) {
      await this.createPersistedWorkflow.execute({
        id: persistedWorkflowId,
        name: draft.metadata.title,
        draft: canonicalDraft,
        lifecycleState,
        metadata,
        ownershipContext,
        versionLabel: draft.lastPublishedVersionId,
      });
      return;
    }

    await this.updatePersistedWorkflow.execute({
      id: persistedWorkflowId,
      changes: {
        name: draft.metadata.title,
        metadata,
        draft: canonicalDraft,
        lifecycleState,
        ownershipContext,
        versionLabel: draft.lastPublishedVersionId ?? existing.revision.versionLabel,
        expectedPersistenceRevision: existing.revision.persistenceRevision,
      },
    });
  }

  private async wrap<T>(action: () => Promise<T>): Promise<StudioShellApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): StudioShellApiError {
    if (error instanceof WorkflowPersistenceError) {
      if (error.code === WorkflowPersistenceErrorCodes.conflict) {
        return Object.freeze({
          code: "conflict",
          message: error.message,
        });
      }
      if (error.code === WorkflowPersistenceErrorCodes.notFound) {
        return Object.freeze({
          code: "not-found",
          message: error.message,
        });
      }
      if (error.code === WorkflowPersistenceErrorCodes.persistenceFailure) {
        return Object.freeze({
          code: "persistence-failed",
          message: error.message,
        });
      }
      return Object.freeze({
        code: "invalid-request",
        message: error.message,
      });
    }

    if (error instanceof StudioShellApplicationError) {
      const codeMap: Record<string, StudioShellApiError["code"]> = {
        [StudioShellErrorCodes.notFound]: "not-found",
        [StudioShellErrorCodes.conflict]: "conflict",
        [StudioShellErrorCodes.invalidLifecycleTransition]: "invalid-lifecycle-transition",
        [StudioShellErrorCodes.invalidRequest]: "invalid-request",
      };
      return Object.freeze({
        code: codeMap[error.code] ?? "invalid-request",
        message: error.message,
      });
    }

    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    if (message.startsWith("not-found:")) {
      return Object.freeze({
        code: "not-found",
        message: message.slice("not-found:".length),
      });
    }
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({
        code: "invalid-request",
        message: message.slice("invalid-request:".length),
      });
    }
    if (message.startsWith("conflict:")) {
      return Object.freeze({
        code: "conflict",
        message: message.slice("conflict:".length),
      });
    }
    if (message.startsWith("validation-failed:")) {
      return Object.freeze({
        code: "validation-failed",
        message: message.slice("validation-failed:".length),
      });
    }
    if (message.startsWith("persistence-failed:")) {
      return Object.freeze({
        code: "persistence-failed",
        message: message.slice("persistence-failed:".length),
      });
    }
    return Object.freeze({
      code: "internal",
      message,
    });
  }
}
