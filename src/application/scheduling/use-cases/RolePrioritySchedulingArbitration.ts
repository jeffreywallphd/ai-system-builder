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

  const sorted = [...eligibleWithRun].sort((left, right) => {
    if (left.candidate.scorecard.rolePriorityScore !== right.candidate.scorecard.rolePriorityScore) {
      return right.candidate.scorecard.rolePriorityScore - left.candidate.scorecard.rolePriorityScore;
    }
    if (left.candidate.scorecard.queueAgeSeconds !== right.candidate.scorecard.queueAgeSeconds) {
      return right.candidate.scorecard.queueAgeSeconds - left.candidate.scorecard.queueAgeSeconds;
    }
    if (left.candidate.runId !== right.candidate.runId) {
      return left.candidate.runId.localeCompare(right.candidate.runId);
    }
    return left.candidate.nodeId.localeCompare(right.candidate.nodeId);
  });

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
}): SchedulingPolicyReason {
  return Object.freeze({
    code: "role-priority-arbitration",
    message: "Role-priority scheduling arbitration selected the highest-ranked eligible candidate.",
    details: Object.freeze({
      tieBreakOrder: RolePrioritySchedulingTieBreakOrder,
      eligibleCandidateCount: input.eligibleCandidateCount,
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
