import {
  AssetDraftLifecycleStatuses,
  type AssetDraftLifecycleStatus,
  type AssetMetadata,
  type AssetMetadataPatch,
} from "../../../domain/studio-shell/StudioShellDomain";
import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import { DefaultStudioShellApplicationService } from "../../../application/studio-shell/DefaultStudioShellApplicationService";
import { WorkflowStudioApplicationService } from "../../../application/workflow-studio/WorkflowStudioApplicationService";
import {
  buildStudioShellValidationIssues,
  tryReadTaxonomyFromVersionMetadata,
  type StudioShellValidationIssue,
} from "../../../application/studio-shell/StudioShellValidation";
import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "../../../application/studio-shell/contracts";
import {
  StudioShellApplicationError,
  StudioShellErrorCodes,
  StudioShellInvalidRequestError,
} from "../../../application/studio-shell/StudioShellApplicationErrors";
import type { IWorkflowPersistenceRepository } from "../../../application/ports/interfaces/IWorkflowPersistenceRepository";
import type { IWorkflowRunSummaryRepository } from "../../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import { CreatePersistedWorkflowUseCase } from "../../../application/workflow-persistence/CreatePersistedWorkflowUseCase";
import { DuplicatePersistedWorkflowUseCase } from "../../../application/workflow-persistence/DuplicatePersistedWorkflowUseCase";
import { GetPersistedWorkflowUseCase } from "../../../application/workflow-persistence/GetPersistedWorkflowUseCase";
import { UpdatePersistedWorkflowUseCase } from "../../../application/workflow-persistence/UpdatePersistedWorkflowUseCase";
import { GetWorkflowRunDetailUseCase } from "../../../application/workflow-run-history/GetWorkflowRunDetailUseCase";
import { ListWorkflowRunSummariesUseCase } from "../../../application/workflow-run-history/ListWorkflowRunSummariesUseCase";
import {
  WorkflowPersistenceError,
  WorkflowPersistenceErrorCodes,
  WorkflowPersistenceInvalidRequestError,
} from "../../../application/workflow-persistence/WorkflowPersistenceErrors";
import { WorkflowLifecycleStates, deserializeWorkflowDraft } from "../../../domain/workflow-studio/WorkflowStudioDomain";
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
} from "../../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "../../../application/workflow-studio/WorkflowExecutionAlignmentContracts";
import type {
  RunWorkflowDraftManualResult,
  WorkflowExecutionFailureDetail,
} from "../../../application/workflow-studio/WorkflowStudioApplicationService";
import {
  DataStudioPipelineExecutionService,
  type DataStudioPipelineExecutionReadiness,
  type RunDataStudioPipelineResult,
} from "../../../application/data-studio/DataStudioPipelineExecutionService";
import {
  createDataStudioPipelineState,
  type DataStudioPipelineState,
} from "../../../application/data-studio/DataStudioPipelineState";
import {
  createDataStudioPipelineVersionMetadata,
  parseDataStudioPipelineVersionMetadata,
  type DataStudioPipelineVersionSummary,
} from "../../../application/data-studio/DataStudioPipelineVersioning";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { UnifiedExecutionEngine } from "../../../application/execution/UnifiedExecutionEngine";
import { DataStudioPipelineExecutionUnitHandler } from "../../execution/DataStudioPipelineExecutionUnitHandler";
import {
  buildReferenceImageDatasetInstanceRequests,
  ReferenceImageSystemTemplate,
} from "../../../application/system-studio/ReferenceImageSystemTemplate";
import { validateReferenceImageCrossStudioContext } from "../../../application/system-studio/ReferenceImageCrossStudioIntegrity";
import { InMemoryDatasetInstanceRepository } from "../../../application/system-runtime/DatasetInstanceRepository";
import {
  SystemDatasetInstanceService,
  type EnsureRoleDatasetInstanceRequest,
} from "../../../application/system-runtime/SystemDatasetInstanceService";
import type { StorageInstanceProvisioningContract } from "../../../application/system-runtime/StorageInstanceProvisioningContract";
import { assertNoUserManagedStoragePaths } from "../../../application/system-runtime/StoragePathPolicyValidation";
import {
  DeterministicStorageInstanceProvisioner,
  InMemoryStorageInstanceMetadataRepository,
  StorageInstanceInitializationService,
  type StorageInstanceMetadataRepository,
} from "../../../application/system-runtime/StorageInstanceInitializationService";
import {
  StorageInstanceLifecycleService,
  type StorageInstanceLifecycleInfrastructure,
} from "../../../application/system-runtime/StorageInstanceLifecycleService";
import type { StorageAttachmentOwnerKind, StorageInstanceMetadata } from "../../../application/system-runtime/StorageInstanceMetadataModel";
import type { DatasetInstanceAssetCatalog, DatasetInstanceAssetDefinition } from "../../../application/system-runtime/DatasetInstanceAssetCatalog";
import { ZodMediaDatasetValidator } from "../../../application/dataset-studio/adapters/validation/MediaDatasetValidator";
import { DatasetSchemaIntentIds } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { createDefaultMediaAdapterBundle } from "../../../application/dataset-studio/adapters/media/MediaAdapterFactory";
import { WorkflowOutputMaterializationService } from "../../../application/system-runtime/WorkflowOutputMaterializationService";
import {
  InMemoryWorkflowOutputArtifactStorage,
  type WorkflowOutputArtifactStorage,
} from "../../../application/system-runtime/WorkflowOutputArtifactStorage";
import { InMemoryWorkflowOutputProvenanceRepository } from "../../../application/system-runtime/WorkflowOutputProvenanceRepository";
import { OutputGalleryDatasetIntegrationService } from "../../../application/system-runtime/OutputGalleryDatasetIntegrationService";
import type { OutputGalleryListing } from "../../../application/system-runtime/OutputGalleryDataContract";
import {
  ImageRunHistoryExecutionStatuses,
  type ImageRunHistoryExecutionStatus,
  type ImageRunHistoryListing,
} from "../../../application/system-runtime/ImageRunHistoryDataContract";
import { ImageRunHistoryService } from "../../../application/system-runtime/ImageRunHistoryService";
import {
  InMemoryImageRunHistoryRepository,
  type ImageRunHistoryRepository,
} from "../../../application/system-runtime/ImageRunHistoryRepository";
import { ComfyExecutionResultMaterializationMapper } from "../../comfyui/execution/mappers/ComfyExecutionResultMaterializationMapper";
import type { SystemContextContract } from "../../../domain/system-studio/SystemContextContract";

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
}

export interface IngestReferenceImageUploadReadModel {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly recordId: string;
  readonly image: {
    readonly assetId: string;
    readonly width: number;
    readonly height: number;
    readonly format: string;
  };
  readonly selectedRecordId: string;
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
}

export interface ListReferenceImageRunHistoryRequest {
  readonly studioId: string;
  readonly draftId?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly status?: ImageRunHistoryExecutionStatus;
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
  readonly operation: "initialize" | "reset" | "archive" | "cleanup";
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
  };
  readonly versionLabel?: string;
}

export interface ListWorkflowStudioRunsRequest {
  readonly workflowId: string;
  readonly status?: WorkflowRunStatus;
  readonly triggerSource?: WorkflowRunTriggerSource;
  readonly limit?: number;
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
      const payload = this.decodeBase64Payload(request.payloadBase64);
      const datasets = await this.ensureReferenceImageDatasetInstances(runtimeSystemId);
      const inputDataset = datasets.get("input-image-dataset");
      if (!inputDataset) {
        throw new StudioShellInvalidRequestError("Reference image input dataset is unavailable.");
      }

      const ingested = await this.referenceImageDatasets.ingestImageRecordIntoInstance({
        systemId: runtimeSystemId,
        instanceId: inputDataset.instanceId,
        storageBindingArea: "input",
        metadata: {
          ingestionSource: "reference-image-ui-upload",
          uploadedFileName: fileName,
          uploadedMimeType: request.mimeType?.trim() || "unknown",
        },
        provenance: {
          sourceType: "upload",
          sourceReference: `upload:${draft.draftId}:${fileName}`,
          sourceSystemId: runtimeSystemId,
          ingestedBy: "studio-shell-ui",
        },
        record: {
          title: fileName,
          format: this.deriveFileFormat(fileName, request.mimeType),
          tags: ["input", "upload"],
        },
        metadataExtraction: {
          payload,
          includeExifInMetadata: true,
        },
      });
      await this.referenceImageDatasets.selectImageRecordInInstance({
        systemId: runtimeSystemId,
        instanceId: inputDataset.instanceId,
        recordId: ingested.recordId,
        selectionContext: {
          selectionMode: "single",
          reason: "latest-upload",
        },
      });

      return Object.freeze({
        systemId: runtimeSystemId,
        datasetInstanceId: inputDataset.instanceId,
        recordId: ingested.recordId,
        image: Object.freeze({
          assetId: ingested.image.assetRef.assetId
            ?? ingested.image.assetRef.stableId
            ?? ingested.image.assetRef.outputId
            ?? ingested.image.assetRef.path
            ?? ingested.recordId,
          width: ingested.image.width,
          height: ingested.image.height,
          format: ingested.image.format,
        }),
        selectedRecordId: ingested.recordId,
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
      const snapshot = await this.requireSnapshot(request.studioId);
      const draft = snapshot.draft;
      if (!draft) {
        throw new StudioShellInvalidRequestError("Open a system draft to view generated images.");
      }
      if (request.draftId?.trim() && draft.draftId !== request.draftId.trim()) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      if (draft.assetId !== ReferenceImageSystemTemplate.systemAsset.assetId) {
        throw new StudioShellInvalidRequestError("Generated image results are only available for the reference image template.");
      }
      const runtimeSystemId = this.resolveReferenceRuntimeSystemId(draft);
      const datasets = await this.ensureReferenceImageDatasetInstances(runtimeSystemId);
      const outputDataset = datasets.get("output-image-dataset");
      if (!outputDataset) {
        throw new StudioShellInvalidRequestError("Reference image output dataset is unavailable.");
      }
      return this.referenceImageOutputGallery.listOutputGalleryItems({
        systemId: runtimeSystemId,
        datasetInstanceId: outputDataset.instanceId,
        limit: request.limit,
        offset: request.offset,
      });
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
      return this.referenceImageRunHistory.listRuns({
        systemId: runtimeSystemId,
        workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        status: request.status,
        limit: request.limit,
        offset: request.offset,
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
      return Object.freeze(summaries.map((summary) => this.toWorkflowRunSummaryReadModel(summary)));
    });
  }

  public async getWorkflowRunDetail(
    runId: string,
  ): Promise<StudioShellApiResponse<WorkflowRunDetailReadModel>> {
    return this.wrap(async () => {
      if (!this.getWorkflowRunDetailUseCase) {
        throw new StudioShellInvalidRequestError("Workflow run history integration is unavailable.");
      }

      const normalizedRunId = runId?.trim();
      if (!normalizedRunId) {
        throw new StudioShellInvalidRequestError("Workflow run id is required.");
      }

      const detail = await this.getWorkflowRunDetailUseCase.execute(normalizedRunId);
      if (!detail) {
        throw new WorkflowPersistenceError(
          WorkflowPersistenceErrorCodes.notFound,
          `Workflow run '${normalizedRunId}' was not found.`,
        );
      }

      return this.toWorkflowRunDetailReadModel(detail);
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

  private async ensureReferenceImageDatasetInstances(systemId: string): Promise<ReadonlyMap<string, Awaited<ReturnType<SystemDatasetInstanceService["ensureRoleDatasetInstance"]>>>> {
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
    await this.ensureReferenceImageDatasetInstances(runtimeSystemId);
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
  ): Promise<StudioShellApiResponse<{ readonly storage: StorageInstanceMetadata }>> {
    return this.wrap(async () => {
      const systemId = request.systemId.trim();
      await this.assertReferenceImageSystemOwnership(systemId);
      const instanceId = request.storageInstanceId.trim();
      const operation = request.operation;
      const storage = operation === "initialize"
        ? await this.storageLifecycle.initialize(instanceId)
        : operation === "reset"
          ? await this.storageLifecycle.reset(instanceId)
          : operation === "archive"
            ? await this.storageLifecycle.archive(instanceId)
            : await this.storageLifecycle.cleanup(instanceId);
      return Object.freeze({ storage });
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
    return Object.freeze({
      code: "internal",
      message,
    });
  }
}
