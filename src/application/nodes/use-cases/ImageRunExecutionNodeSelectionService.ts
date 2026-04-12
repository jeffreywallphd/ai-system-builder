import {
  ExecutionNodeEligibilityDecisionKinds,
  ImageRunExecutionNodeSelectionOutcomes,
  type ExecutionNodeListQuery,
  type IImageRunExecutionNodeSelectionServicePort,
  type IImageRunNodeEligibilityEvaluationServicePort,
  type ImageRunExecutionNodeSelectionCandidate,
  type ImageRunExecutionNodeSelectionDecision,
  type ImageRunExecutionNodeSelectionReason,
  type ImageRunNodeEligibilityRequirements,
  type ImageRunNodeEligibilityResult,
  type ImageRunNodeEligibilityRunContext,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";
import {
  ExecutionNodeManagementAuditEventTypes,
  type ExecutionNodeManagementAuditSink,
  publishExecutionNodeManagementAuditEventBestEffort,
} from "../ports/ExecutionNodeManagementAuditPorts";

interface ImageRunExecutionNodeSelectionServiceDependencies {
  readonly eligibilityService: Pick<IImageRunNodeEligibilityEvaluationServicePort, "evaluateRunToCandidateNodes">;
  readonly auditSink?: ExecutionNodeManagementAuditSink;
}

const StrategyId = "image-run-node-selection.v1.deterministic-eligible-first";

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toCandidate(
  evaluation: ImageRunNodeEligibilityResult,
  rank: number,
): ImageRunExecutionNodeSelectionCandidate {
  return Object.freeze({
    nodeId: evaluation.nodeId,
    rank,
    decision: evaluation.decision,
    eligible: evaluation.eligible,
    matchedBackendFamily: evaluation.matchedBackendFamily,
    matchedExecutionTarget: evaluation.matchedExecutionTarget,
    blockingReasonCodes: Object.freeze(evaluation.summary.blockingReasonCodes),
    advisoryReasonCodes: Object.freeze(evaluation.summary.advisoryReasonCodes),
    transientAvailabilityReasonCodes: Object.freeze(evaluation.summary.transientAvailabilityReasonCodes),
  });
}

function buildNoCandidatesDecision(input: {
  readonly asOf: string;
  readonly run: ImageRunNodeEligibilityRunContext;
}): ImageRunExecutionNodeSelectionDecision {
  const reasons: ReadonlyArray<ImageRunExecutionNodeSelectionReason> = Object.freeze([
    Object.freeze({
      code: ImageRunExecutionNodeSelectionOutcomes.noCandidateNodes,
      message: "No execution-node candidates were available for selection.",
    }),
  ]);
  return Object.freeze({
    run: Object.freeze({ ...input.run }),
    asOf: input.asOf,
    strategyId: StrategyId,
    outcome: ImageRunExecutionNodeSelectionOutcomes.noCandidateNodes,
    reasons,
    candidates: Object.freeze([]),
  });
}

function buildNoEligibleDecision(input: {
  readonly asOf: string;
  readonly run: ImageRunNodeEligibilityRunContext;
  readonly candidates: ReadonlyArray<ImageRunExecutionNodeSelectionCandidate>;
  readonly evaluations: ReadonlyArray<ImageRunNodeEligibilityResult>;
}): ImageRunExecutionNodeSelectionDecision {
  const reasonCodeCounts = new Map<string, number>();
  for (const evaluation of input.evaluations) {
    for (const code of evaluation.summary.blockingReasonCodes) {
      reasonCodeCounts.set(code, (reasonCodeCounts.get(code) ?? 0) + 1);
    }
  }
  const topBlockingReasonCodes = [...reasonCodeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([code]) => code);
  const reasons: ReadonlyArray<ImageRunExecutionNodeSelectionReason> = Object.freeze([
    Object.freeze({
      code: ImageRunExecutionNodeSelectionOutcomes.noEligibleNode,
      message: "No eligible execution node was found for this run.",
      details: Object.freeze({
        candidateCount: input.candidates.length,
        topBlockingReasonCodes: Object.freeze(topBlockingReasonCodes),
      }),
    }),
  ]);

  return Object.freeze({
    run: Object.freeze({ ...input.run }),
    asOf: input.asOf,
    strategyId: StrategyId,
    outcome: ImageRunExecutionNodeSelectionOutcomes.noEligibleNode,
    reasons,
    candidates: Object.freeze(input.candidates),
  });
}

export class ImageRunExecutionNodeSelectionService implements IImageRunExecutionNodeSelectionServicePort {
  public constructor(private readonly dependencies: ImageRunExecutionNodeSelectionServiceDependencies) {}

  public async selectExecutionNodeForRun(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ImageRunExecutionNodeSelectionDecision> {
    const asOf = normalizeOptional(input.asOf) ?? new Date().toISOString();
    const run = Object.freeze({ ...input.run });

    const evaluations = await this.dependencies.eligibilityService.evaluateRunToCandidateNodes({
      asOf,
      run,
      requirements: input.requirements,
      candidateNodeIds: input.candidateNodeIds,
      query: input.query,
    });

    if (evaluations.length === 0) {
      const decision = buildNoCandidatesDecision({
        asOf,
        run,
      });
      await this.publishSelectionAuditEvent({
        run,
        decision,
      });
      return decision;
    }

    const orderedEvaluations = evaluations
      .slice()
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));

    const rankedEvaluations = orderedEvaluations
      .slice()
      .sort((left, right) => {
        const decisionRank = toDecisionRank(left.decision) - toDecisionRank(right.decision);
        if (decisionRank !== 0) {
          return decisionRank;
        }
        const advisoryRank = left.summary.advisoryReasonCodes.length - right.summary.advisoryReasonCodes.length;
        if (advisoryRank !== 0) {
          return advisoryRank;
        }
        const findingRank = left.summary.findingCount - right.summary.findingCount;
        if (findingRank !== 0) {
          return findingRank;
        }
        return left.nodeId.localeCompare(right.nodeId);
      });

    const candidates = rankedEvaluations.map((evaluation, index) => toCandidate(evaluation, index + 1));
    const selectedEvaluation = rankedEvaluations.find((evaluation) => evaluation.eligible);
    if (!selectedEvaluation) {
      const decision = buildNoEligibleDecision({
        asOf,
        run,
        candidates,
        evaluations: rankedEvaluations,
      });
      await this.publishSelectionAuditEvent({
        run,
        decision,
      });
      return decision;
    }

    const selectedCandidate = candidates.find((candidate) => candidate.nodeId === selectedEvaluation.nodeId);
    const reasons: ReadonlyArray<ImageRunExecutionNodeSelectionReason> = Object.freeze([
      Object.freeze({
        code: ImageRunExecutionNodeSelectionOutcomes.selected,
        message: "Deterministic eligible-node selection succeeded.",
        details: Object.freeze({
          selectedNodeId: selectedEvaluation.nodeId,
          advisoryReasonCodes: Object.freeze(selectedEvaluation.summary.advisoryReasonCodes),
          candidateCount: candidates.length,
        }),
      }),
    ]);

    const decision = Object.freeze({
      run,
      asOf,
      strategyId: StrategyId,
      outcome: ImageRunExecutionNodeSelectionOutcomes.selected,
      selectedNodeId: selectedEvaluation.nodeId,
      selectedCandidate,
      reasons,
      candidates: Object.freeze(candidates),
    });
    await this.publishSelectionAuditEvent({
      run,
      decision,
    });
    return decision;
  }

  private async publishSelectionAuditEvent(input: {
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly decision: ImageRunExecutionNodeSelectionDecision;
  }): Promise<void> {
    await publishExecutionNodeManagementAuditEventBestEffort(this.dependencies.auditSink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeSelectionEvaluated,
      actorUserIdentityId: "service:run-node-selection",
      occurredAt: input.decision.asOf,
      runId: input.run.runId,
      workspaceId: input.run.workspaceId,
      nodeId: input.decision.selectedNodeId,
      outcome: input.decision.outcome === ImageRunExecutionNodeSelectionOutcomes.selected
        ? "success"
        : "rejected",
      details: Object.freeze({
        strategyId: input.decision.strategyId,
        outcome: input.decision.outcome,
        selectedNodeId: input.decision.selectedNodeId,
        candidateCount: input.decision.candidates.length,
        reasonCodes: Object.freeze(input.decision.reasons.map((reason) => reason.code)),
      }),
    });
  }
}

function toDecisionRank(decision: string): number {
  if (decision === ExecutionNodeEligibilityDecisionKinds.eligible) {
    return 0;
  }
  if (decision === ExecutionNodeEligibilityDecisionKinds.unavailable) {
    return 1;
  }
  return 2;
}
