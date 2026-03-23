import {
  ExecutionPlan,
  ExecutionStatuses,
  type ExecutionStatus,
  type ExecutionUnitDefinition,
} from "../../domain/execution/ExecutionPlan";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionProvenance,
  IWorkflowExecutionResult,
} from "../ports/interfaces/IWorkflowExecutor";

export interface IExecutionEngineEvent {
  readonly planId: string;
  readonly unitId: string;
  readonly status: ExecutionStatus;
  readonly message?: string;
  readonly provenance?: IWorkflowExecutionProvenance;
  readonly workflowEvent?: IWorkflowExecutionEvent;
}

export interface IExecutionUnitExecutionRequest {
  readonly plan: ExecutionPlan;
  readonly unit: ExecutionUnitDefinition;
  readonly unitInputs?: Readonly<Record<string, unknown>>;
}

export interface IExecutionUnitExecutionResult {
  readonly unitId: string;
  readonly status: Extract<ExecutionStatus, "completed" | "failed" | "skipped">;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
  readonly provenance?: IWorkflowExecutionProvenance;
  readonly workflowResult?: IWorkflowExecutionResult;
}

export interface IExecutionUnitHandler {
  canHandle(unit: ExecutionUnitDefinition): boolean;
  execute(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionUnitExecutionResult>;
}

export interface IExecutionPlanRequest {
  readonly plan: ExecutionPlan;
  readonly unitInputs?: Readonly<Record<string, unknown>>;
}

export interface IExecutionUnitTransition {
  readonly unitId: string;
  readonly fromStatus?: ExecutionStatus;
  readonly toStatus: ExecutionStatus;
  readonly message?: string;
  readonly provenance?: IWorkflowExecutionProvenance;
}

export interface IExecutionPlanResult {
  readonly planId: string;
  readonly status: Extract<ExecutionStatus, "completed" | "failed">;
  readonly unitStatuses: Readonly<Record<string, ExecutionStatus>>;
  readonly transitions: ReadonlyArray<IExecutionUnitTransition>;
  readonly unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>;
}

function freezeRecord<TValue>(value: Record<string, TValue>): Readonly<Record<string, TValue>> {
  return Object.freeze({ ...value });
}

export class UnifiedExecutionEngine {
  private readonly handlers: ReadonlyArray<IExecutionUnitHandler>;

  constructor(handlers: ReadonlyArray<IExecutionUnitHandler>) {
    this.handlers = Object.freeze([...handlers]);
  }

  public async execute(
    request: IExecutionPlanRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionPlanResult> {
    const statuses = request.plan.units.reduce<Record<string, ExecutionStatus>>((acc, unit) => {
      acc[unit.id] = unit.dependsOn.length === 0 ? ExecutionStatuses.ready : ExecutionStatuses.pending;
      return acc;
    }, {});
    const transitions: IExecutionUnitTransition[] = [];
    const unitResults: Record<string, IExecutionUnitExecutionResult> = {};

    while (true) {
      const readyUnits = request.plan.getReadyUnits(statuses);
      const nextUnit = readyUnits.find((unit) => statuses[unit.id] === ExecutionStatuses.ready)
        ?? readyUnits[0];

      if (!nextUnit) {
        break;
      }

      this.recordTransition({
        transitions,
        statuses,
        unitId: nextUnit.id,
        toStatus: ExecutionStatuses.running,
      });
      onEvent?.({
        planId: request.plan.id,
        unitId: nextUnit.id,
        status: ExecutionStatuses.running,
        message: `Running execution unit '${nextUnit.id}'.`,
      });

      const handler = this.resolveHandler(nextUnit);
      const result = await handler.execute(
        {
          plan: request.plan,
          unit: nextUnit,
          unitInputs: request.unitInputs,
        },
        onEvent,
      );
      unitResults[nextUnit.id] = Object.freeze({ ...result });
      this.recordTransition({
        transitions,
        statuses,
        unitId: nextUnit.id,
        toStatus: result.status,
        message: result.errorMessage,
        provenance: result.provenance,
      });

      if (result.status === ExecutionStatuses.failed) {
        this.skipRemainingUnits({
          plan: request.plan,
          statuses,
          transitions,
          failedUnitId: nextUnit.id,
        });

        return Object.freeze({
          planId: request.plan.id,
          status: ExecutionStatuses.failed,
          unitStatuses: freezeRecord(statuses),
          transitions: Object.freeze([...transitions]),
          unitResults: freezeRecord(unitResults),
        });
      }

      this.refreshReadyStatuses(request.plan, statuses, transitions);
    }

    const hasIncompleteUnits = request.plan.units.some((unit) => {
      const status = statuses[unit.id];
      return status !== ExecutionStatuses.completed && status !== ExecutionStatuses.skipped;
    });

    if (hasIncompleteUnits) {
      throw new Error(
        `Execution plan '${request.plan.id}' could not resolve the next executable unit.`,
      );
    }

    return Object.freeze({
      planId: request.plan.id,
      status: ExecutionStatuses.completed,
      unitStatuses: freezeRecord(statuses),
      transitions: Object.freeze([...transitions]),
      unitResults: freezeRecord(unitResults),
    });
  }

  private refreshReadyStatuses(
    plan: ExecutionPlan,
    statuses: Record<string, ExecutionStatus>,
    transitions: IExecutionUnitTransition[],
  ): void {
    for (const unit of plan.getReadyUnits(statuses)) {
      if (statuses[unit.id] === ExecutionStatuses.pending) {
        this.recordTransition({
          transitions,
          statuses,
          unitId: unit.id,
          toStatus: ExecutionStatuses.ready,
        });
      }
    }
  }

  private skipRemainingUnits(params: {
    readonly plan: ExecutionPlan;
    readonly statuses: Record<string, ExecutionStatus>;
    readonly transitions: IExecutionUnitTransition[];
    readonly failedUnitId: string;
  }): void {
    for (const unit of params.plan.units) {
      const status = params.statuses[unit.id];
      if (status === ExecutionStatuses.completed || status === ExecutionStatuses.failed || status === ExecutionStatuses.skipped) {
        continue;
      }

      this.recordTransition({
        transitions: params.transitions,
        statuses: params.statuses,
        unitId: unit.id,
        toStatus: ExecutionStatuses.skipped,
        message: `Skipped after '${params.failedUnitId}' failed.`,
      });
    }
  }

  private resolveHandler(unit: ExecutionUnitDefinition): IExecutionUnitHandler {
    const handler = this.handlers.find((candidate) => candidate.canHandle(unit));

    if (!handler) {
      throw new Error(`No execution unit handler is registered for '${unit.kind}'.`);
    }

    return handler;
  }

  private recordTransition(params: {
    readonly transitions: IExecutionUnitTransition[];
    readonly statuses: Record<string, ExecutionStatus>;
    readonly unitId: string;
    readonly toStatus: ExecutionStatus;
    readonly message?: string;
    readonly provenance?: IWorkflowExecutionProvenance;
  }): void {
    const fromStatus = params.statuses[params.unitId];
    params.statuses[params.unitId] = params.toStatus;
    params.transitions.push(
      Object.freeze({
        unitId: params.unitId,
        fromStatus,
        toStatus: params.toStatus,
        message: params.message,
        provenance: params.provenance,
      })
    );
  }
}
