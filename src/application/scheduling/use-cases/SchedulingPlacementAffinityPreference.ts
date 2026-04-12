import type {
  SchedulingCandidateDecision,
  SchedulingNodePolicyInput,
  SchedulingPolicyReason,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  if (!values || values.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze([
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ]);
}

function hasAffinityConfigured(run: SchedulingRunPolicyInput): boolean {
  const affinity = run.requirements.placementAffinity;
  if (!affinity) {
    return false;
  }
  return Boolean(
    (affinity.preferredNodeIds && affinity.preferredNodeIds.length > 0)
    || (affinity.preferredNodeTypes && affinity.preferredNodeTypes.length > 0)
    || (affinity.preferredDeploymentProfileIds && affinity.preferredDeploymentProfileIds.length > 0),
  );
}

function isAffinityMatch(run: SchedulingRunPolicyInput, node: SchedulingNodePolicyInput): boolean {
  const affinity = run.requirements.placementAffinity;
  if (!affinity) {
    return true;
  }

  const preferredNodeIds = normalizeStringList(affinity.preferredNodeIds);
  if (preferredNodeIds.length > 0 && !preferredNodeIds.includes(node.nodeId)) {
    return false;
  }

  if (
    affinity.preferredNodeTypes
    && affinity.preferredNodeTypes.length > 0
    && !affinity.preferredNodeTypes.includes(node.nodeType)
  ) {
    return false;
  }

  const preferredDeploymentProfileIds = normalizeStringList(affinity.preferredDeploymentProfileIds);
  if (preferredDeploymentProfileIds.length > 0) {
    const deploymentProfileId = normalizeOptional(node.deploymentProfileId);
    if (!deploymentProfileId || !preferredDeploymentProfileIds.includes(deploymentProfileId)) {
      return false;
    }
  }

  return true;
}

function toAffinityReason(input: {
  readonly code: string;
  readonly message: string;
  readonly run: SchedulingRunPolicyInput;
  readonly candidateCount: number;
  readonly preferredCandidateCount: number;
}): SchedulingPolicyReason {
  const affinity = input.run.requirements.placementAffinity;
  return Object.freeze({
    code: input.code,
    message: input.message,
    details: Object.freeze({
      runId: input.run.runId,
      candidateCount: input.candidateCount,
      preferredCandidateCount: input.preferredCandidateCount,
      preferredNodeIds: Object.freeze([...(affinity?.preferredNodeIds ?? [])]),
      preferredNodeTypes: Object.freeze([...(affinity?.preferredNodeTypes ?? [])]),
      preferredDeploymentProfileIds: Object.freeze([...(affinity?.preferredDeploymentProfileIds ?? [])]),
    }),
  });
}

export interface SchedulingPlacementAffinityPreferenceResult {
  readonly eligibleCandidates: ReadonlyArray<SchedulingCandidateDecision>;
  readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
}

export function applyBasicPlacementAffinityPreference(input: {
  readonly eligibleCandidates: ReadonlyArray<SchedulingCandidateDecision>;
  readonly runs: ReadonlyArray<SchedulingRunPolicyInput>;
  readonly nodes: ReadonlyArray<SchedulingNodePolicyInput>;
}): SchedulingPlacementAffinityPreferenceResult {
  if (input.eligibleCandidates.length === 0) {
    return Object.freeze({
      eligibleCandidates: Object.freeze([]),
      reasons: Object.freeze([]),
    });
  }

  const runById = new Map(input.runs.map((run) => [run.runId, run] as const));
  const nodeById = new Map(input.nodes.map((node) => [node.nodeId, node] as const));
  const candidatesByRunId = new Map<string, SchedulingCandidateDecision[]>();
  for (const candidate of input.eligibleCandidates) {
    const list = candidatesByRunId.get(candidate.runId);
    if (list) {
      list.push(candidate);
      continue;
    }
    candidatesByRunId.set(candidate.runId, [candidate]);
  }

  const preferredCandidates: SchedulingCandidateDecision[] = [];
  const reasons: SchedulingPolicyReason[] = [];

  for (const [runId, candidates] of candidatesByRunId.entries()) {
    const run = runById.get(runId);
    if (!run || !hasAffinityConfigured(run)) {
      preferredCandidates.push(...candidates);
      continue;
    }

    const matching = candidates.filter((candidate) => {
      const node = nodeById.get(candidate.nodeId);
      if (!node) {
        return false;
      }
      return isAffinityMatch(run, node);
    });

    if (matching.length > 0) {
      preferredCandidates.push(...matching);
      if (matching.length < candidates.length) {
        reasons.push(toAffinityReason({
          code: "placement-affinity-preference-applied",
          message: `Placement affinity filtered scheduling candidates for run '${run.runId}'.`,
          run,
          candidateCount: candidates.length,
          preferredCandidateCount: matching.length,
        }));
      }
      continue;
    }

    preferredCandidates.push(...candidates);
    reasons.push(toAffinityReason({
      code: "placement-affinity-preference-unmet",
      message: `Placement affinity had no eligible node matches for run '${run.runId}'; scheduler fell back to all eligible candidates.`,
      run,
      candidateCount: candidates.length,
      preferredCandidateCount: 0,
    }));
  }

  return Object.freeze({
    eligibleCandidates: Object.freeze(preferredCandidates),
    reasons: Object.freeze(reasons),
  });
}
