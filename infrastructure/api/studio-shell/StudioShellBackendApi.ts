import type { AssetDraftLifecycleStatus, AssetMetadata, AssetMetadataPatch } from "../../../domain/studio-shell/StudioShellDomain";
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
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "../../../application/workflow-studio/WorkflowExecutionAlignmentContracts";

export interface StudioShellApiError {
  readonly code: "not-found" | "conflict" | "invalid-request" | "invalid-lifecycle-transition" | "validation-failed" | "internal";
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

export class StudioShellBackendApi {
  private readonly service: DefaultStudioShellApplicationService;
  private readonly workflowStudioService: WorkflowStudioApplicationService;

  constructor(private readonly repository: IStudioShellRepository) {
    this.service = new DefaultStudioShellApplicationService(repository);
    this.workflowStudioService = new WorkflowStudioApplicationService(
      this.service,
      undefined,
      undefined,
      {
        hasAssetVersionReference: async (versionId: string) => Boolean(await this.repository.getAssetVersion(versionId)),
      },
    );
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
      return this.requireSnapshot(command.studioId);
    });
  }

  public async updateDraft(command: UpdateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.updateAssetDraft(command);
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
      return this.requireSnapshot(command.studioId);
    });
  }

  public async publishVersion(command: PublishAssetDraftVersionCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.publishAssetDraftVersion(command);
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

  private async wrap<T>(action: () => Promise<T>): Promise<StudioShellApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): StudioShellApiError {
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
