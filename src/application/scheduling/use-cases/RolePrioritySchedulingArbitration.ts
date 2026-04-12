import type {
  SchedulingCandidateDecision,
  SchedulingPolicyReason,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";

export const RolePrioritySchedulingTieBreakOrder = Object.freeze([
  "role-priority-score",
  "queue-age-seconds",
  "run-id",
  "node-id",
]);

export function compareRolePrioritySchedulingCandidates(
  left: SchedulingCandidateDecision,
  right: SchedulingCandidateDecision,
): number {
  if (left.scorecard.rolePriorityScore !== right.scorecard.rolePriorityScore) {
    return right.scorecard.rolePriorityScore - left.scorecard.rolePriorityScore;
  }
  if (left.scorecard.queueAgeSeconds !== right.scorecard.queueAgeSeconds) {
    return right.scorecard.queueAgeSeconds - left.scorecard.queueAgeSeconds;
  }
  if (left.runId !== right.runId) {
    return left.runId.localeCompare(right.runId);
  }
  return left.nodeId.localeCompare(right.nodeId);
}

export function orderRolePrioritySchedulingCandidates(
  candidates: ReadonlyArray<SchedulingCandidateDecision>,
): ReadonlyArray<SchedulingCandidateDecision> {
  return Object.freeze([...candidates].sort(compareRolePrioritySchedulingCandidates));
}

export interface RolePrioritySchedulingSelection {
  readonly candidate: SchedulingCandidateDecision;
  readonly run: SchedulingRunPolicyInput;
}

export function selectRolePrioritySchedulingCandidate(input: {
  readonly eligibleCandidates: ReadonlyArray<SchedulingCandidateDecision>;
  readonly runs: ReadonlyArray<SchedulingRunPolicyInput>;
}): RolePrioritySchedulingSelection | undefined {
  const runById = new Map(input.runs.map((run) => [run.runId, run] as const));
  const eligibleWithRun = input.eligibleCandidates
    .map((candidate) => Object.freeze({
      candidate,
      run: runById.get(candidate.runId),
    }))
    .filter((entry): entry is Readonly<{ candidate: SchedulingCandidateDecision; run: SchedulingRunPolicyInput }> => (
      Boolean(entry.run)
    ));

  if (eligibleWithRun.length === 0) {
    return undefined;
  }

  const sorted = [...eligibleWithRun].sort((left, right) => (
    compareRolePrioritySchedulingCandidates(left.candidate, right.candidate)
  ));

  const winner = sorted[0];
  if (!winner) {
    return undefined;
  }

  return Object.freeze({
    candidate: winner.candidate,
    run: winner.run,
  });
}

export function createRolePrioritySchedulingArbitrationReason(input: {
  readonly selected: RolePrioritySchedulingSelection;
  readonly eligibleCandidateCount: number;
  readonly rankedCandidates: ReadonlyArray<SchedulingCandidateDecision>;
}): SchedulingPolicyReason {
  const topRankedCandidates = input.rankedCandidates.slice(0, 3).map((candidate) => Object.freeze({
    runId: candidate.runId,
    nodeId: candidate.nodeId,
    rolePriorityScore: candidate.scorecard.rolePriorityScore,
    queueAgeSeconds: candidate.scorecard.queueAgeSeconds,
  }));
  const decisiveTieBreakStage = resolveDecisiveTieBreakStage(input.rankedCandidates);

  return Object.freeze({
    code: "role-priority-arbitration",
    message: "Role-priority scheduling arbitration selected the highest-ranked eligible candidate.",
    details: Object.freeze({
      tieBreakOrder: RolePrioritySchedulingTieBreakOrder,
      eligibleCandidateCount: input.eligibleCandidateCount,
      decisiveTieBreakStage,
      topRankedCandidates: Object.freeze(topRankedCandidates),
      selected: Object.freeze({
        runId: input.selected.run.runId,
        nodeId: input.selected.candidate.nodeId,
        workspaceRoleKeys: Object.freeze([...input.selected.run.workspaceRoleKeys]),
        priorityBand: input.selected.candidate.scorecard.priorityBand,
        rolePriorityScore: input.selected.candidate.scorecard.rolePriorityScore,
        queueAgeSeconds: input.selected.candidate.scorecard.queueAgeSeconds,
      }),
    }),
  });
}

function resolveDecisiveTieBreakStage(
  rankedCandidates: ReadonlyArray<SchedulingCandidateDecision>,
): string {
  const winner = rankedCandidates[0];
  const runnerUp = rankedCandidates[1];
  if (!winner || !runnerUp) {
    return "single-candidate";
  }

  if (winner.scorecard.rolePriorityScore !== runnerUp.scorecard.rolePriorityScore) {
    return "role-priority-score";
  }
  if (winner.scorecard.queueAgeSeconds !== runnerUp.scorecard.queueAgeSeconds) {
    return "queue-age-seconds";
  }
  if (winner.runId !== runnerUp.runId) {
    return "run-id";
  }
  if (winner.nodeId !== runnerUp.nodeId) {
    return "node-id";
  }

  return "exact-match";
}
