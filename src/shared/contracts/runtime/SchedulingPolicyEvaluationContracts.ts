import type { SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  SchedulingCandidateDecision,
  SchedulingCandidateScorecard,
  SchedulingNodePolicyInput,
  SchedulingPolicyDecision,
  SchedulingPolicyReason,
  SchedulingPolicySourceKind,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";
import {
  SchedulingDecisionOutcomes,
  SchedulingRunPriorityBands,
} from "@domain/scheduling/SchedulingDomain";

export const SchedulingPolicyEvaluationContractVersions = Object.freeze({
  v1: "scheduling-policy-evaluation/v1",
} as const);

export type SchedulingPolicyEvaluationContractVersion =
  typeof SchedulingPolicyEvaluationContractVersions[keyof typeof SchedulingPolicyEvaluationContractVersions];

export const SchedulingPolicyEvaluationReasonCodes = Object.freeze({
  queueEmpty: "queue-empty",
  noEligibleCandidates: "no-eligible-candidates",
  noPlacement: "no-placement",
  rolePriorityPreempted: "role-priority-preempted",
  deferredByPolicy: "deferred-by-policy",
  deniedByPolicy: "denied-by-policy",
  capacityUnavailable: "capacity-unavailable",
  arbitrationSuppressed: "arbitration-suppressed",
} as const);

export type SchedulingPolicyEvaluationReasonCode =
  typeof SchedulingPolicyEvaluationReasonCodes[keyof typeof SchedulingPolicyEvaluationReasonCodes];

export interface SchedulingQueueLease {
  readonly runId: string;
  readonly queueId: string;
  readonly enteredAt: string;
  readonly eligibleAt: string;
  readonly claimToken: string;
  readonly claimOwner: string;
  readonly claimExpiresAt: string;
}

export interface SchedulingPriorityMetadata {
  readonly priorityBand: SchedulingCandidateScorecard["priorityBand"];
  readonly rolePriorityScore: number;
  readonly queueAgeSeconds: number;
}

export interface SchedulingReservationStatus {
  readonly claimOwner: string;
  readonly nodeReservationOwner?: string;
  readonly reservationConflict: boolean;
}

export interface SchedulingCandidateReasoningSummary {
  readonly runId: string;
  readonly nodeId: string;
  readonly eligible: boolean;
  readonly priority: SchedulingPriorityMetadata;
  readonly reservation: SchedulingReservationStatus;
  readonly exclusionReasonCodes: ReadonlyArray<string>;
  readonly exclusionReasons: ReadonlyArray<SchedulingPolicyReason>;
}

export interface SchedulingReasonCodeSummaryEntry {
  readonly code: string;
  readonly count: number;
  readonly sampleMessage: string;
}

export interface SchedulingExclusionReasonSample {
  readonly runId: string;
  readonly nodeId: string;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface SchedulingDecisionReasonSummary {
  readonly decisionReasonCodes: ReadonlyArray<string>;
  readonly decisionReasonCatalog: ReadonlyArray<SchedulingReasonCodeSummaryEntry>;
  readonly exclusionReasonCodes: ReadonlyArray<string>;
  readonly exclusionReasonCatalog: ReadonlyArray<SchedulingReasonCodeSummaryEntry>;
  readonly exclusionSamples: ReadonlyArray<SchedulingExclusionReasonSample>;
}

export interface SchedulingQueueEvaluationSummary {
  readonly queueLeaseCount: number;
  readonly runCount: number;
  readonly nodeCount: number;
  readonly candidateCount: number;
  readonly eligibleCandidateCount: number;
  readonly excludedCandidateCount: number;
}

export interface SchedulingPolicySnapshotMetadata {
  readonly contractVersion: SchedulingPolicyEvaluationContractVersion;
  readonly decisionId: string;
  readonly occurredAt: string;
  readonly policySources: ReadonlyArray<SchedulingPolicySourceKind>;
  readonly deploymentProfileId?: string;
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

export interface SchedulingPolicyEvaluationResult {
  readonly snapshot: SchedulingPolicySnapshotMetadata;
  readonly outcome: SchedulingPolicyDecision["outcome"];
  readonly selected: SchedulingPolicyDecision["selected"];
  readonly summary: SchedulingQueueEvaluationSummary;
  readonly queueEvaluation: ReadonlyArray<SchedulingCandidateReasoningSummary>;
  readonly reasonSummary: SchedulingDecisionReasonSummary;
  readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
}

export interface SchedulingDecisionBundle {
  readonly snapshot: SchedulingEvaluationSnapshot;
  readonly decision: SchedulingPolicyDecision;
  readonly assignmentIntents: ReadonlyArray<SchedulingAssignmentIntent>;
  readonly evaluation: SchedulingPolicyEvaluationResult;
}

export interface SchedulingEvaluationReadRequest {
  readonly decisionId: string;
}

export interface SchedulingEvaluationReadResponse {
  readonly decision: SchedulingPolicyEvaluationResult;
}

export interface SchedulingEvaluationListRequest {
  readonly queueId?: string;
  readonly workspaceId?: string;
  readonly outcomes?: ReadonlyArray<SchedulingPolicyDecision["outcome"]>;
  readonly limit?: number;
}

export interface SchedulingEvaluationListResponse {
  readonly items: ReadonlyArray<SchedulingPolicyEvaluationResult>;
  readonly asOf: string;
}

export interface SchedulingPolicyEvaluationTransportContract {
  readonly getSchedulingEvaluation: {
    readonly request: SchedulingEvaluationReadRequest;
    readonly response: SharedApiResponseEnvelope<SchedulingEvaluationReadResponse>;
  };
  readonly listSchedulingEvaluations: {
    readonly request: SchedulingEvaluationListRequest;
    readonly response: SharedApiResponseEnvelope<SchedulingEvaluationListResponse>;
  };
}

function toPriorityMetadata(scorecard: SchedulingCandidateScorecard): SchedulingPriorityMetadata {
  return Object.freeze({
    priorityBand: scorecard.priorityBand,
    rolePriorityScore: scorecard.rolePriorityScore,
    queueAgeSeconds: scorecard.queueAgeSeconds,
  });
}

function sanitizeReasonMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (normalized.length <= 256) {
    return normalized;
  }

  return `${normalized.slice(0, 253)}...`;
}

function toReasonCodeCatalog(
  reasons: ReadonlyArray<SchedulingPolicyReason>,
): ReadonlyArray<SchedulingReasonCodeSummaryEntry> {
  const tally = new Map<string, { count: number; sampleMessage: string }>();
  for (const reason of reasons) {
    const existing = tally.get(reason.code);
    if (existing) {
      existing.count += 1;
      continue;
    }

    tally.set(reason.code, {
      count: 1,
      sampleMessage: sanitizeReasonMessage(reason.message),
    });
  }

  return Object.freeze(
    [...tally.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, value]) => Object.freeze({
        code,
        count: value.count,
        sampleMessage: value.sampleMessage,
      })),
  );
}

export function toSchedulingDecisionReasonSummary(input: {
  readonly decision: SchedulingPolicyDecision;
}): SchedulingDecisionReasonSummary {
  const decisionReasonCodes = Object.freeze([...new Set(input.decision.reasons.map((reason) => reason.code))]);
  const exclusionReasons = input.decision.evaluatedCandidates
    .filter((candidate) => !candidate.eligible)
    .flatMap((candidate) => candidate.denialReasons);
  const exclusionReasonCodes = Object.freeze([...new Set(exclusionReasons.map((reason) => reason.code))]);
  const exclusionSamples = Object.freeze(
    input.decision.evaluatedCandidates
      .filter((candidate) => !candidate.eligible)
      .slice(0, 32)
      .map((candidate) => Object.freeze({
        runId: candidate.runId,
        nodeId: candidate.nodeId,
        reasonCodes: Object.freeze([...new Set(candidate.denialReasons.map((reason) => reason.code))]),
      })),
  );

  return Object.freeze({
    decisionReasonCodes,
    decisionReasonCatalog: toReasonCodeCatalog(input.decision.reasons),
    exclusionReasonCodes,
    exclusionReasonCatalog: toReasonCodeCatalog(exclusionReasons),
    exclusionSamples,
  });
}

export function toSchedulingCandidateReasoningSummary(input: {
  readonly candidate: SchedulingCandidateDecision;
  readonly run?: SchedulingRunPolicyInput;
  readonly node?: SchedulingNodePolicyInput;
}): SchedulingCandidateReasoningSummary {
  const claimOwner = input.run?.queue.claimOwner ?? "";
  const nodeReservationOwner = input.node?.reservationOwner;
  const reservationConflict = Boolean(
    claimOwner
      && nodeReservationOwner
      && nodeReservationOwner !== claimOwner,
  );

  return Object.freeze({
    runId: input.candidate.runId,
    nodeId: input.candidate.nodeId,
    eligible: input.candidate.eligible,
    priority: toPriorityMetadata(input.candidate.scorecard),
    reservation: Object.freeze({
      claimOwner,
      nodeReservationOwner,
      reservationConflict,
    }),
    exclusionReasonCodes: Object.freeze(
      [...new Set(input.candidate.denialReasons.map((reason) => reason.code))],
    ),
    exclusionReasons: Object.freeze([...input.candidate.denialReasons]),
  });
}

export function toSchedulingQueueEvaluationSummary(input: {
  readonly snapshot: SchedulingEvaluationSnapshot;
  readonly evaluatedCandidates: ReadonlyArray<SchedulingCandidateDecision>;
}): SchedulingQueueEvaluationSummary {
  const candidateCount = input.evaluatedCandidates.length;
  const eligibleCandidateCount = input.evaluatedCandidates.filter((candidate) => candidate.eligible).length;

  return Object.freeze({
    queueLeaseCount: input.snapshot.queueLeases.length,
    runCount: input.snapshot.runs.length,
    nodeCount: input.snapshot.nodes.length,
    candidateCount,
    eligibleCandidateCount,
    excludedCandidateCount: Math.max(0, candidateCount - eligibleCandidateCount),
  });
}

export function toSchedulingPolicyEvaluationResult(input: {
  readonly snapshot: SchedulingEvaluationSnapshot;
  readonly decision: SchedulingPolicyDecision;
}): SchedulingPolicyEvaluationResult {
  const runById = new Map(input.snapshot.runs.map((run) => [run.runId, run] as const));
  const nodeById = new Map(input.snapshot.nodes.map((node) => [node.nodeId, node] as const));

  const queueEvaluation = Object.freeze(input.decision.evaluatedCandidates.map((candidate) => (
    toSchedulingCandidateReasoningSummary({
      candidate,
      run: runById.get(candidate.runId),
      node: nodeById.get(candidate.nodeId),
    })
  )));

  return Object.freeze({
    snapshot: Object.freeze({
      contractVersion: SchedulingPolicyEvaluationContractVersions.v1,
      decisionId: input.decision.decisionId,
      occurredAt: input.decision.occurredAt,
      policySources: input.decision.policySources,
      deploymentProfileId: input.snapshot.deploymentProfileId,
    }),
    outcome: input.decision.outcome,
    selected: input.decision.selected,
    summary: toSchedulingQueueEvaluationSummary({
      snapshot: input.snapshot,
      evaluatedCandidates: input.decision.evaluatedCandidates,
    }),
    queueEvaluation,
    reasonSummary: toSchedulingDecisionReasonSummary({
      decision: input.decision,
    }),
    reasons: Object.freeze([...input.decision.reasons]),
  });
}

export function createSchedulingDecisionBundle(input: {
  readonly snapshot: SchedulingEvaluationSnapshot;
  readonly decision: SchedulingPolicyDecision;
  readonly assignmentIntents: ReadonlyArray<SchedulingAssignmentIntent>;
}): SchedulingDecisionBundle {
  return Object.freeze({
    snapshot: input.snapshot,
    decision: input.decision,
    assignmentIntents: Object.freeze([...input.assignmentIntents]),
    evaluation: toSchedulingPolicyEvaluationResult({
      snapshot: input.snapshot,
      decision: input.decision,
    }),
  });
}

export function createSchedulingOutcomeReason(
  code: SchedulingPolicyEvaluationReasonCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): SchedulingPolicyReason {
  return Object.freeze({
    code,
    message,
    details,
  });
}

export function isSchedulingTerminalOutcome(outcome: SchedulingPolicyDecision["outcome"]): boolean {
  return outcome === SchedulingDecisionOutcomes.denied || outcome === SchedulingDecisionOutcomes.assignmentRecommended;
}

export function normalizeSchedulingPriorityBand(value: string): SchedulingCandidateScorecard["priorityBand"] {
  const normalized = value.trim();
  if (!normalized) {
    return SchedulingRunPriorityBands.normal;
  }

  const allowed = Object.values(SchedulingRunPriorityBands);
  return allowed.includes(normalized as SchedulingCandidateScorecard["priorityBand"])
    ? normalized as SchedulingCandidateScorecard["priorityBand"]
    : SchedulingRunPriorityBands.normal;
}
