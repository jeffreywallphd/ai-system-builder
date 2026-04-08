import type { AssignmentReadySelectionItem } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import type { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import type { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import {
  type ClaimRunForNodeDispatchPreparationUseCase,
  type ClaimRunForNodeDispatchPreparationResult,
  type RunNodeDispatchClaimConflictError,
} from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";

interface ProcessQueuedRunDispatchUseCaseDependencies {
  readonly selectAssignmentReadyRunsUseCase: Pick<SelectAssignmentReadyRunsUseCase, "execute">;
  readonly claimRunForNodeDispatchPreparationUseCase: Pick<ClaimRunForNodeDispatchPreparationUseCase, "execute">;
  readonly dispatchAssignedRunExecutionUseCase: Pick<DispatchAssignedRunExecutionUseCase, "execute">;
  readonly now?: () => Date;
}

export interface ProcessQueuedRunDispatchRequest {
  readonly reservationOwner: string;
  readonly nodeId: string;
  readonly asOf?: string;
  readonly queueId?: string;
  readonly workspaceId?: string;
  readonly limit?: number;
  readonly reservationTtlSeconds?: number;
}

export interface ProcessQueuedRunDispatchSuccess {
  readonly status: "dispatched";
  readonly runId: string;
  readonly queueId: string;
  readonly nodeId: string;
  readonly dispatchAttemptId: string;
  readonly backendKind: string;
  readonly dispatchId: string;
  readonly backendRunId?: string;
  readonly acceptedAt: string;
}

export interface ProcessQueuedRunDispatchFailure {
  readonly status: "failed";
  readonly runId: string;
  readonly queueId: string;
  readonly nodeId: string;
  readonly dispatchAttemptId?: string;
  readonly stage: "claim" | "dispatch";
  readonly message: string;
  readonly conflictReason?: RunNodeDispatchClaimConflictError["conflict"]["reason"];
}

export type ProcessQueuedRunDispatchOutcome =
  | ProcessQueuedRunDispatchSuccess
  | ProcessQueuedRunDispatchFailure;

export interface ProcessQueuedRunDispatchResult {
  readonly asOf: string;
  readonly reservationOwner: string;
  readonly nodeId: string;
  readonly selectedCount: number;
  readonly outcomes: ReadonlyArray<ProcessQueuedRunDispatchOutcome>;
}

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class ProcessQueuedRunDispatchUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: ProcessQueuedRunDispatchUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(input: ProcessQueuedRunDispatchRequest): Promise<ProcessQueuedRunDispatchResult> {
    const reservationOwner = normalizeRequired(input.reservationOwner, "reservationOwner");
    const nodeId = normalizeRequired(input.nodeId, "nodeId");
    const asOf = normalizeOptional(input.asOf) ?? this.now().toISOString();

    const selected = await this.dependencies.selectAssignmentReadyRunsUseCase.execute({
      reservationOwner,
      asOf,
      queueId: normalizeOptional(input.queueId),
      workspaceId: normalizeOptional(input.workspaceId),
      limit: input.limit,
      reservationTtlSeconds: input.reservationTtlSeconds,
    });

    const outcomes: ProcessQueuedRunDispatchOutcome[] = [];
    for (const item of selected.items) {
      const claimed = await this.claimForDispatch({
        item,
        nodeId,
        reservationOwner,
      });
      if ("error" in claimed) {
        outcomes.push(claimed.error);
        continue;
      }

      try {
        const dispatched = await this.dependencies.dispatchAssignedRunExecutionUseCase.execute({
          runId: item.run.runId,
          dispatchAttemptId: claimed.value.dispatchPreparation.dispatchAttemptId,
        });
        outcomes.push(Object.freeze({
          status: "dispatched",
          runId: item.run.runId,
          queueId: item.queue.queueId,
          nodeId,
          dispatchAttemptId: claimed.value.dispatchPreparation.dispatchAttemptId,
          backendKind: dispatched.receipt.backendKind,
          dispatchId: dispatched.receipt.dispatchId,
          backendRunId: dispatched.receipt.backendRunId,
          acceptedAt: dispatched.receipt.acceptedAt,
        }));
      } catch (error) {
        outcomes.push(Object.freeze({
          status: "failed",
          runId: item.run.runId,
          queueId: item.queue.queueId,
          nodeId,
          dispatchAttemptId: claimed.value.dispatchPreparation.dispatchAttemptId,
          stage: "dispatch",
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    }

    return Object.freeze({
      asOf: selected.asOf,
      reservationOwner,
      nodeId,
      selectedCount: selected.items.length,
      outcomes: Object.freeze(outcomes),
    });
  }

  private async claimForDispatch(input: {
    readonly item: AssignmentReadySelectionItem;
    readonly nodeId: string;
    readonly reservationOwner: string;
  }): Promise<
    | { readonly value: ClaimRunForNodeDispatchPreparationResult }
    | { readonly error: ProcessQueuedRunDispatchFailure }
  > {
    try {
      const claimed = await this.dependencies.claimRunForNodeDispatchPreparationUseCase.execute({
        runId: input.item.run.runId,
        nodeId: input.nodeId,
        reservationOwner: input.reservationOwner,
        claimToken: input.item.queue.claimToken,
      });
      return Object.freeze({
        value: claimed,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "RunNodeDispatchClaimConflictError") {
        const conflictError = error as RunNodeDispatchClaimConflictError;
        return Object.freeze({
          error: Object.freeze({
            status: "failed",
            runId: input.item.run.runId,
            queueId: input.item.queue.queueId,
            nodeId: input.nodeId,
            stage: "claim",
            conflictReason: conflictError.conflict.reason,
            message: conflictError.message,
          }),
        });
      }
      return Object.freeze({
        error: Object.freeze({
          status: "failed",
          runId: input.item.run.runId,
          queueId: input.item.queue.queueId,
          nodeId: input.nodeId,
          stage: "claim",
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }
}
