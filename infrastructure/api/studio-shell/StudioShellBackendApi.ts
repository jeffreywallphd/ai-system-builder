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
  type WorkflowRunDetailRecord,
  type WorkflowRunStatus,
  type WorkflowRunSummaryRecord,
  type WorkflowRunTriggerSource,
} from "../../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "../../../application/workflow-studio/WorkflowExecutionAlignmentContracts";

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

export interface WorkflowExecutionOutputDeliveryResultReadModel {
  readonly outputId: string;
  readonly destinationType: "web-viewer" | "file-export" | "system-entry" | "prompt-response-chat";
  readonly target: string;
  readonly status: "delivered" | "failed";
  readonly detail?: string;
}

export interface RunWorkflowStudioDraftReadModel {
  readonly launchStatus: "blocked" | "launched" | "failed";
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
  readonly stepRunStats?: WorkflowRunSummaryRecord["stepRunStats"];
}

export interface WorkflowRunDetailReadModel {
  readonly runId: string;
  readonly summary: WorkflowRunSummaryReadModel;
  readonly stepRuns: WorkflowRunDetailRecord["stepRuns"];
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

  constructor(
    private readonly repository: IStudioShellRepository,
    workflowPersistenceRepository?: IWorkflowPersistenceRepository,
    workflowRunSummaryRepository?: IWorkflowRunSummaryRepository,
  ) {
    this.service = new DefaultStudioShellApplicationService(repository);
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
      await this.service.publishAssetDraftVersion(command);
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

      return Object.freeze({
        launchStatus: runResult.launchStatus,
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
      stepRunStats: summary.stepRunStats,
    } satisfies WorkflowRunSummaryReadModel);
  }

  private toWorkflowRunDetailReadModel(detail: WorkflowRunDetailRecord): WorkflowRunDetailReadModel {
    return Object.freeze({
      runId: detail.runId,
      summary: this.toWorkflowRunSummaryReadModel(detail.summary),
      stepRuns: Object.freeze([...detail.stepRuns]),
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
          .map((entry) => Object.freeze({
            versionId: entry.versionId,
            versionLabel: entry.versionLabel,
            parentVersionId: entry.parentVersionId,
            createdAt: entry.createdAt.toISOString(),
          })),
      ),
      validationIssues,
    });
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
