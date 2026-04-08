import type { AssignmentReadySelectionItem } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import type { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import type { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import type {
  ExecutionNodeListQuery,
  ImageRunExecutionNodeSelectionDecision,
  IImageRunExecutionNodeSelectionServicePort,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";
import {
  type ClaimRunForNodeDispatchPreparationUseCase,
  type ClaimRunForNodeDispatchPreparationResult,
  type RunNodeDispatchClaimConflictError,
} from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";

interface ProcessQueuedRunDispatchUseCaseDependencies {
  readonly selectAssignmentReadyRunsUseCase: Pick<SelectAssignmentReadyRunsUseCase, "execute">;
  readonly claimRunForNodeDispatchPreparationUseCase: Pick<ClaimRunForNodeDispatchPreparationUseCase, "execute">;
  readonly dispatchAssignedRunExecutionUseCase: Pick<DispatchAssignedRunExecutionUseCase, "execute">;
  readonly runNodeSelectionService: Pick<IImageRunExecutionNodeSelectionServicePort, "selectExecutionNodeForRun">;
  readonly queueRepository: {
    releaseRunClaim(input: {
      readonly runId: string;
      readonly claimToken: string;
      readonly releasedAt: string;
    }): Promise<boolean>;
  };
  readonly now?: () => Date;
}

export interface ProcessQueuedRunDispatchRequest {
  readonly reservationOwner: string;
  readonly nodeId?: string;
  readonly candidateNodeIds?: ReadonlyArray<string>;
  readonly selectionQuery?: ExecutionNodeListQuery;
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
  readonly nodeId?: string;
  readonly dispatchAttemptId?: string;
  readonly stage: "selection" | "claim" | "dispatch";
  readonly message: string;
  readonly conflictReason?: RunNodeDispatchClaimConflictError["conflict"]["reason"];
  readonly selection?: {
    readonly outcome: ImageRunExecutionNodeSelectionDecision["outcome"];
    readonly reasons: ImageRunExecutionNodeSelectionDecision["reasons"];
    readonly candidateCount: number;
  };
}

export type ProcessQueuedRunDispatchOutcome =
  | ProcessQueuedRunDispatchSuccess
  | ProcessQueuedRunDispatchFailure;

export interface ProcessQueuedRunDispatchResult {
  readonly asOf: string;
  readonly reservationOwner: string;
  readonly requestedNodeId?: string;
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
    const requestedNodeId = normalizeOptional(input.nodeId);
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
      const selection = await this.selectExecutionNodeForRun({
        item,
        asOf: selected.asOf,
        requestedNodeId,
        candidateNodeIds: input.candidateNodeIds,
        selectionQuery: input.selectionQuery,
      });
      if ("error" in selection) {
        outcomes.push(selection.error);
        continue;
      }

      const claimed = await this.claimForDispatch({
        item,
        nodeId: selection.value.selectedNodeId,
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
          nodeId: selection.value.selectedNodeId,
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
          nodeId: selection.value.selectedNodeId,
          dispatchAttemptId: claimed.value.dispatchPreparation.dispatchAttemptId,
          stage: "dispatch",
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    }

    return Object.freeze({
      asOf: selected.asOf,
      reservationOwner,
      requestedNodeId,
      selectedCount: selected.items.length,
      outcomes: Object.freeze(outcomes),
    });
  }

  private async selectExecutionNodeForRun(input: {
    readonly item: AssignmentReadySelectionItem;
    readonly asOf: string;
    readonly requestedNodeId?: string;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly selectionQuery?: ExecutionNodeListQuery;
  }): Promise<
    | { readonly value: { readonly selectedNodeId: string } }
    | { readonly error: ProcessQueuedRunDispatchFailure }
  > {
    const selectionDecision = await this.dependencies.runNodeSelectionService.selectExecutionNodeForRun({
      asOf: input.asOf,
      run: Object.freeze({
        runId: input.item.run.runId,
        workspaceId: input.item.run.workspaceId ?? "workspace:unknown",
        workflowId: input.item.run.workflowId,
      }),
      requirements: Object.freeze({
        requiredExecutionTarget: "image-manipulation",
        requiredBackendFamilies: Object.freeze(["comfyui"]),
        requiresRemoteScheduling: true,
      }),
      candidateNodeIds: resolveCandidateNodeIds({
        requestedNodeId: input.requestedNodeId,
        candidateNodeIds: input.candidateNodeIds,
      }),
      query: input.selectionQuery,
    });

    if (selectionDecision.selectedNodeId) {
      return Object.freeze({
        value: Object.freeze({
          selectedNodeId: selectionDecision.selectedNodeId,
        }),
      });
    }

    await this.releaseSelectionClaim(input.item, input.asOf);
    return Object.freeze({
      error: Object.freeze({
        status: "failed",
        runId: input.item.run.runId,
        queueId: input.item.queue.queueId,
        stage: "selection",
        message: selectionDecision.reasons[0]?.message
          ?? "No eligible execution node was available for dispatch.",
        selection: Object.freeze({
          outcome: selectionDecision.outcome,
          reasons: selectionDecision.reasons,
          candidateCount: selectionDecision.candidates.length,
        }),
      }),
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

  private async releaseSelectionClaim(item: AssignmentReadySelectionItem, releasedAt: string): Promise<void> {
    await this.dependencies.queueRepository.releaseRunClaim({
      runId: item.run.runId,
      claimToken: item.queue.claimToken,
      releasedAt,
    });
  }
}

function resolveCandidateNodeIds(input: {
  readonly requestedNodeId?: string;
  readonly candidateNodeIds?: ReadonlyArray<string>;
}): ReadonlyArray<string> | undefined {
  if (input.requestedNodeId) {
    return Object.freeze([input.requestedNodeId]);
  }
  if (!input.candidateNodeIds || input.candidateNodeIds.length === 0) {
    return undefined;
  }
  return Object.freeze(input.candidateNodeIds
    .map((entry) => normalizeOptional(entry))
    .filter((entry): entry is string => Boolean(entry)));
}
