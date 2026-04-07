import type {
  SchedulingNodePolicyInput,
  SchedulingPolicyDecision,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";

export interface SchedulingQueueLease {
  readonly runId: string;
  readonly queueId: string;
  readonly enteredAt: string;
  readonly eligibleAt: string;
  readonly claimToken: string;
  readonly claimOwner: string;
  readonly claimExpiresAt: string;
}

export interface SchedulingEvaluationSnapshot {
  readonly asOf: string;
  readonly queueLeases: ReadonlyArray<SchedulingQueueLease>;
  readonly runs: ReadonlyArray<SchedulingRunPolicyInput>;
  readonly nodes: ReadonlyArray<SchedulingNodePolicyInput>;
  readonly deploymentProfileId?: string;
}

export interface SchedulingAssignmentIntent {
  readonly runId: string;
  readonly nodeId: string;
  readonly queueId: string;
  readonly claimToken: string;
  readonly reservationOwner: string;
  readonly decisionId: string;
  readonly decidedAt: string;
}

export interface SchedulingDecisionBundle {
  readonly snapshot: SchedulingEvaluationSnapshot;
  readonly decision: SchedulingPolicyDecision;
  readonly assignmentIntents: ReadonlyArray<SchedulingAssignmentIntent>;
}

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
