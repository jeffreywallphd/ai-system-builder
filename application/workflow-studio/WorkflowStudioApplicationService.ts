import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { AssetDraftDependencyReference } from "../../domain/studio-shell/StudioShellDomain";
import { AssetDraftLifecycleStatuses } from "../../domain/studio-shell/StudioShellDomain";
import type {
  AssetDraftResult,
  AssetVersionResult,
  StudioInitializationResult,
  StudioSessionResult,
} from "../studio-shell/contracts";
import type { StudioShellApplicationService } from "../studio-shell/StudioShellApplicationService";
import { StudioShellConflictError, StudioShellInvalidRequestError } from "../studio-shell/StudioShellApplicationErrors";
import { assertCompositeStudioDraftPublishConsistency } from "../studio-shell/AtomicStudioAssetEnforcement";
import {
  createWorkflowAssetMetadata,
  createWorkflowStudioTaxonomy,
  deserializeWorkflowDraft,
  validateWorkflowDraft,
  WorkflowStudioIdentity,
} from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  mapWorkflowDraftToExecutionPlan,
  type WorkflowDraftExecutionPlan,
} from "./WorkflowDraftExecutionPlanMapper";
import {
  WorkflowDraftExecutionRuntime,
  type WorkflowDraftRuntimeExecutionResult,
  type WorkflowDraftRuntimeManualDecision,
} from "./WorkflowDraftExecutionRuntime";

export interface EnsureWorkflowStudioResult {
  readonly initialized: boolean;
  readonly studio: StudioInitializationResult["studio"];
  readonly session: StudioInitializationResult["activeSession"];
}

export interface CreateWorkflowDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly behaviorKind?: "deterministic" | "conditional" | "iterative";
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface PublishWorkflowDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly createdBy?: string;
}

export interface PlanWorkflowDraftExecutionCommand {
  readonly content: string;
}

export interface ExecuteWorkflowDraftCommand extends PlanWorkflowDraftExecutionCommand {
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly manualDecisionsByStepId?: Readonly<Record<string, WorkflowDraftRuntimeManualDecision | undefined>>;
  readonly maxLoopIterations?: number;
}

export class WorkflowStudioApplicationService {
  private readonly runtimeExecutor: WorkflowDraftExecutionRuntime;

  constructor(
    private readonly studioShellService: StudioShellApplicationService,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy"> = new CompositionAssetContractResolver(),
    runtimeExecutor: WorkflowDraftExecutionRuntime = new WorkflowDraftExecutionRuntime(),
  ) {
    this.runtimeExecutor = runtimeExecutor;
  }

  public async ensureStudioInitialized(
    studioId: string = WorkflowStudioIdentity.defaultStudioId,
    studioName: string = WorkflowStudioIdentity.defaultStudioName,
  ): Promise<EnsureWorkflowStudioResult> {
    const normalizedStudioId = studioId.trim();
    let initialized = false;
    let sessionResult: StudioSessionResult;
    try {
      const created = await this.studioShellService.initializeStudio({
        studioId: normalizedStudioId,
        name: studioName,
      });
      initialized = true;
      sessionResult = Object.freeze({
        studio: created.studio,
        session: created.activeSession,
        drafts: Object.freeze([]),
      });
    } catch (error) {
      if (!(error instanceof StudioShellConflictError)) {
        throw error;
      }
      sessionResult = await this.studioShellService.startAssetSession({
        studioId: normalizedStudioId,
      });
    }

    return Object.freeze({
      initialized,
      studio: sessionResult.studio,
      session: sessionResult.session,
    });
  }

  public async createWorkflowDraft(command: CreateWorkflowDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || WorkflowStudioIdentity.defaultStudioId;
    const taxonomy = createWorkflowStudioTaxonomy(command.behaviorKind);
    const contract = this.contractResolver.resolveContractForTaxonomy(taxonomy);

    return this.studioShellService.createAssetDraft({
      studioId,
      sessionId: command.sessionId,
      content: command.content,
      metadata: createWorkflowAssetMetadata({
        title: command.title,
        summary: command.summary,
        tags: command.tags,
        creatorId: command.creatorId,
        behaviorKind: command.behaviorKind,
        contract,
      }),
      dependencies: command.dependencies,
    });
  }

  private async assertPublishConsistency(studioId: string, draftId: string): Promise<void> {
    const snapshot = await this.studioShellService.loadAssetDraft({ studioId, draftId });
    if (!snapshot) {
      throw new StudioShellInvalidRequestError(`Draft '${draftId}' is not available in studio '${studioId}'.`);
    }

    assertCompositeStudioDraftPublishConsistency({
      draft: snapshot.draft,
      expectation: {
        studioType: WorkflowStudioIdentity.studioType,
        semanticRole: "workflow",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative"],
      },
      contractResolver: this.contractResolver,
    });

    let canonicalDraft;
    try {
      canonicalDraft = deserializeWorkflowDraft(snapshot.draft.content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Workflow draft content is not valid JSON.";
      throw new StudioShellInvalidRequestError(`Workflow draft content is malformed: ${detail}`);
    }

    const workflowValidation = validateWorkflowDraft(canonicalDraft);
    if (!workflowValidation.valid) {
      const issueSummary = workflowValidation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.code)
        .slice(0, 5)
        .join(", ");
      throw new StudioShellInvalidRequestError(
        `Workflow draft is not publish-ready: ${issueSummary || "validation-failed"}.`,
      );
    }
  }

  public async publishWorkflowDraft(command: PublishWorkflowDraftCommand): Promise<AssetVersionResult> {
    const studioId = command.studioId?.trim() || WorkflowStudioIdentity.defaultStudioId;
    await this.assertPublishConsistency(studioId, command.draftId);
    await this.studioShellService.transitionAssetDraftLifecycle({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    return this.studioShellService.publishAssetDraftVersion({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      versionId: command.versionId,
      versionLabel: command.versionLabel,
      createdBy: command.createdBy,
    });
  }

  public planWorkflowDraftExecution(command: PlanWorkflowDraftExecutionCommand): WorkflowDraftExecutionPlan {
    let canonicalDraft;
    try {
      canonicalDraft = deserializeWorkflowDraft(command.content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Workflow draft content is not valid JSON.";
      throw new StudioShellInvalidRequestError(`Workflow draft content is malformed: ${detail}`);
    }

    try {
      return mapWorkflowDraftToExecutionPlan(canonicalDraft);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "workflow-draft-execution-plan-failed";
      throw new StudioShellInvalidRequestError(`Workflow draft execution planning failed: ${detail}`);
    }
  }

  public async executeWorkflowDraft(
    command: ExecuteWorkflowDraftCommand,
  ): Promise<WorkflowDraftRuntimeExecutionResult> {
    const plan = this.planWorkflowDraftExecution(command);
    try {
      return await this.runtimeExecutor.execute({
        plan,
        inputs: command.inputs,
        manualDecisionsByStepId: command.manualDecisionsByStepId,
        maxLoopIterations: command.maxLoopIterations,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "workflow-draft-runtime-execution-failed";
      throw new StudioShellInvalidRequestError(`Workflow draft runtime execution failed: ${detail}`);
    }
  }
}
