import { ExecutionStatuses } from "../../domain/execution/ExecutionPlan";
import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import {
  createDataStudioPipelineExecutionPlan,
  requireDataStudioPipelineExecutionResult,
  type DataStudioPipelineExecutionResult,
} from "./DataStudioPipelineExecution";
import {
  DataStudioPipelineValidationService,
  type DataStudioPipelineValidationIssue,
  type DataStudioPipelineValidationResult,
} from "./DataStudioPipelineValidation";
import type { DataStudioPipelineState } from "./DataStudioPipelineState";

export const DataStudioExecutionLifecycleStates = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
});

export type DataStudioExecutionLifecycleState =
  typeof DataStudioExecutionLifecycleStates[keyof typeof DataStudioExecutionLifecycleStates];

export interface DataStudioPipelineExecutionReadiness {
  readonly ready: boolean;
  readonly executionReady: boolean;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: ReadonlyArray<DataStudioPipelineValidationIssue>;
  readonly stageResults: DataStudioPipelineValidationResult["stageResults"];
}

export interface RunDataStudioPipelineRequest {
  readonly pipelineState: DataStudioPipelineState;
  readonly initiatedBy?: string;
  readonly executionReason?: string;
}

export interface RunDataStudioPipelineResult {
  readonly launchStatus: "blocked" | "launched" | "failed";
  readonly readiness: DataStudioPipelineExecutionReadiness;
  readonly execution: {
    readonly runId?: string;
    readonly planId?: string;
    readonly state: DataStudioExecutionLifecycleState;
    readonly launchAccepted: boolean;
    readonly transitions: ReadonlyArray<{
      readonly unitId: string;
      readonly state: string;
      readonly message?: string;
      readonly occurredAt: string;
    }>;
  };
  readonly result?: DataStudioPipelineExecutionResult;
  readonly failureMessage?: string;
}

function toReadiness(result: DataStudioPipelineValidationResult): DataStudioPipelineExecutionReadiness {
  return Object.freeze({
    ready: result.ready,
    executionReady: result.executionReady,
    blockingIssueCount: result.blockingIssues.length,
    warningIssueCount: result.warningIssues.length,
    issues: result.issues,
    stageResults: result.stageResults,
  });
}

export class DataStudioPipelineExecutionService {
  private readonly validationService: DataStudioPipelineValidationService;
  private readonly executionEngine: UnifiedExecutionEngine;

  constructor(
    executionEngine: UnifiedExecutionEngine,
    validationService: DataStudioPipelineValidationService = new DataStudioPipelineValidationService(),
  ) {
    this.executionEngine = executionEngine;
    this.validationService = validationService;
  }

  public assessReadiness(pipelineState: DataStudioPipelineState): DataStudioPipelineExecutionReadiness {
    const validation = this.validationService.validate(pipelineState, { mode: "execution" });
    return toReadiness(validation);
  }

  public async run(request: RunDataStudioPipelineRequest): Promise<RunDataStudioPipelineResult> {
    const validation = this.validationService.validate(request.pipelineState, { mode: "execution" });
    const readiness = toReadiness(validation);
    if (!validation.executionReady || validation.blockingIssues.length > 0) {
      return Object.freeze({
        launchStatus: "blocked",
        readiness,
        execution: Object.freeze({
          state: DataStudioExecutionLifecycleStates.failed,
          launchAccepted: false,
          transitions: Object.freeze([]),
        }),
      });
    }

    try {
      const envelope = createDataStudioPipelineExecutionPlan({
        pipelineState: request.pipelineState,
        initiatedBy: request.initiatedBy,
        executionReason: request.executionReason,
      });
      const planResult = await this.executionEngine.execute({
        plan: envelope.plan,
        unitInputs: envelope.unitInputs,
        metadata: envelope.metadata,
      });
      const executionResult = requireDataStudioPipelineExecutionResult(planResult, envelope.unitId);
      const success = planResult.status === ExecutionStatuses.completed && executionResult.status === "completed";

      return Object.freeze({
        launchStatus: success ? "launched" : "failed",
        readiness,
        execution: Object.freeze({
          runId: planResult.runId,
          planId: planResult.planId,
          state: success ? DataStudioExecutionLifecycleStates.completed : DataStudioExecutionLifecycleStates.failed,
          launchAccepted: true,
          transitions: Object.freeze(planResult.transitions.map((transition) => Object.freeze({
            unitId: transition.unitId,
            state: transition.toStatus,
            message: transition.message,
            occurredAt: transition.occurredAt,
          }))),
        }),
        result: executionResult,
        failureMessage: success ? undefined : (executionResult.errors[0] ?? planResult.run.finalErrorMessage),
      });
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Data pipeline execution failed.";
      return Object.freeze({
        launchStatus: "failed",
        readiness,
        execution: Object.freeze({
          state: DataStudioExecutionLifecycleStates.failed,
          launchAccepted: false,
          transitions: Object.freeze([]),
        }),
        failureMessage,
      });
    }
  }
}
