import type {
  SchedulingAssignmentIntent as SharedSchedulingAssignmentIntent,
  SchedulingDecisionBundle as SharedSchedulingDecisionBundle,
  SchedulingEvaluationSnapshot as SharedSchedulingEvaluationSnapshot,
  SchedulingQueueLease as SharedSchedulingQueueLease,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";

/** @deprecated Use shared scheduling contracts from @shared/contracts/runtime/SchedulingPolicyEvaluationContracts. */
export type SchedulingQueueLease = SharedSchedulingQueueLease;

/** @deprecated Use shared scheduling contracts from @shared/contracts/runtime/SchedulingPolicyEvaluationContracts. */
export type SchedulingEvaluationSnapshot = SharedSchedulingEvaluationSnapshot;

/** @deprecated Use shared scheduling contracts from @shared/contracts/runtime/SchedulingPolicyEvaluationContracts. */
export type SchedulingAssignmentIntent = SharedSchedulingAssignmentIntent;

/** @deprecated Use shared scheduling contracts from @shared/contracts/runtime/SchedulingPolicyEvaluationContracts. */
export type SchedulingDecisionBundle = SharedSchedulingDecisionBundle;

export interface IAuthoritativeSchedulingInputAssembler {
  assemble(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingEvaluationSnapshot>;
}

export interface IAuthoritativeSchedulingPolicyEvaluator {
  evaluate(snapshot: SchedulingEvaluationSnapshot): Promise<SchedulingDecisionBundle>;
}

export interface IAuthoritativeSchedulingDecisionPipeline {
  evaluateNextAssignments(input: {
    readonly asOf?: string;
    readonly reservationOwner: string;
    readonly limit?: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingDecisionBundle>;
}

export interface IAuthoritativeSchedulingAssignmentGateway {
  materializeAssignmentIntents(input: {
    readonly decisionBundle: SchedulingDecisionBundle;
  }): Promise<ReadonlyArray<SchedulingAssignmentIntent>>;
}

export interface IAuthoritativeDispatchExecutionGateway {
  dispatchAssignedRun(input: SchedulingAssignmentIntent): Promise<Readonly<{
    readonly runId: string;
    readonly nodeId: string;
    readonly dispatchAttemptId: string;
    readonly accepted: boolean;
  }>>;
}
