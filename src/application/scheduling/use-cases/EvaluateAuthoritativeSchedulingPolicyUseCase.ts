import { randomUUID } from "node:crypto";
import type { IAuthoritativeSchedulingPolicyEvaluator } from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import {
  createSchedulingDecisionBundle,
  createSchedulingOutcomeReason,
  SchedulingPolicyEvaluationReasonCodes,
  type SchedulingDecisionBundle,
  type SchedulingEvaluationSnapshot,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import {
  createSchedulingPolicyDecision,
  SchedulingDecisionOutcomes,
  SchedulingPolicySourceKinds,
  type SchedulingCandidateDecision,
  type SchedulingPolicyReason,
  type SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";
import {
  DefaultSchedulingPolicyRules,
  RolePriorityQueueAgeSchedulingScorePolicy,
  SchedulingPolicyRulePipeline,
} from "./SchedulingPolicyRulePipeline";
import type {
  ISchedulingCandidateScorePolicy,
  ISchedulingPolicyRule,
} from "@application/scheduling/ports/SchedulingPolicyRulePorts";

interface EvaluateAuthoritativeSchedulingPolicyUseCaseDependencies {
  readonly now?: () => Date;
  readonly decisionIdFactory?: () => string;
  readonly scorePolicy?: ISchedulingCandidateScorePolicy;
  readonly rules?: ReadonlyArray<ISchedulingPolicyRule>;
}

export class EvaluateAuthoritativeSchedulingPolicyUseCase implements IAuthoritativeSchedulingPolicyEvaluator {
  private readonly now: () => Date;
  private readonly decisionIdFactory: () => string;
  private readonly rulePipeline: SchedulingPolicyRulePipeline;

  public constructor(dependencies: EvaluateAuthoritativeSchedulingPolicyUseCaseDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.decisionIdFactory = dependencies.decisionIdFactory ?? (() => randomUUID());
    this.rulePipeline = new SchedulingPolicyRulePipeline(
      dependencies.scorePolicy ?? new RolePriorityQueueAgeSchedulingScorePolicy(),
      dependencies.rules ?? DefaultSchedulingPolicyRules,
    );
  }

  public async evaluate(snapshot: SchedulingEvaluationSnapshot): Promise<SchedulingDecisionBundle> {
    const occurredAt = this.now().toISOString();
    const evaluatedCandidates = await this.evaluateCandidates(snapshot);
    const eligibleCandidates = evaluatedCandidates.filter((candidate) => candidate.eligible);
    const selected = chooseSelectedCandidate(eligibleCandidates, snapshot.runs);

    const reasons: SchedulingPolicyReason[] = [
      Object.freeze({
        code: "rule-pipeline-evaluated",
        message: "Scheduling policy rules were evaluated in configured order.",
        details: Object.freeze({
          ruleOrder: this.rulePipeline.getRuleOrder(),
          candidateCount: evaluatedCandidates.length,
          eligibleCandidateCount: eligibleCandidates.length,
        }),
      }),
    ];

    let outcome = SchedulingDecisionOutcomes.assignmentRecommended;
    if (evaluatedCandidates.length === 0) {
      outcome = SchedulingDecisionOutcomes.deferred;
      reasons.push(createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.queueEmpty,
        "No scheduling candidates were available for evaluation.",
      ));
    } else if (!selected) {
      outcome = SchedulingDecisionOutcomes.deferred;
      reasons.push(createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.noEligibleCandidates,
        "Scheduling candidates were evaluated, but none were eligible for assignment.",
      ));
    }

    const policySources = Object.freeze([
      SchedulingPolicySourceKinds.runSubmission,
      SchedulingPolicySourceKinds.workspaceMembershipRoles,
      SchedulingPolicySourceKinds.nodeTrustInventory,
      SchedulingPolicySourceKinds.activeReservations,
      ...(snapshot.deploymentProfileId ? [SchedulingPolicySourceKinds.deploymentProfile] : []),
    ]);

    const decision = createSchedulingPolicyDecision({
      decisionId: this.decisionIdFactory(),
      occurredAt,
      outcome,
      selected: selected
        ? Object.freeze({
          runId: selected.run.runId,
          nodeId: selected.candidate.nodeId,
          claimToken: selected.run.queue.claimToken,
          reservationOwner: selected.run.queue.claimOwner,
        })
        : undefined,
      evaluatedCandidates,
      reasons,
      policySources,
    });

    const assignmentIntents = selected
      ? Object.freeze([Object.freeze({
        runId: selected.run.runId,
        nodeId: selected.candidate.nodeId,
        queueId: selected.run.queue.queueId,
        claimToken: selected.run.queue.claimToken,
        reservationOwner: selected.run.queue.claimOwner,
        decisionId: decision.decisionId,
        decidedAt: decision.occurredAt,
      })])
      : Object.freeze([]);

    return createSchedulingDecisionBundle({
      snapshot,
      decision,
      assignmentIntents,
    });
  }

  private async evaluateCandidates(snapshot: SchedulingEvaluationSnapshot): Promise<ReadonlyArray<SchedulingCandidateDecision>> {
    const results: SchedulingCandidateDecision[] = [];
    for (const run of snapshot.runs) {
      for (const node of snapshot.nodes) {
        const evaluated = await this.rulePipeline.evaluateCandidate({
          asOf: snapshot.asOf,
          run,
          node,
        });
        results.push(evaluated.candidate);
      }
    }

    return Object.freeze(results);
  }
}

function chooseSelectedCandidate(
  candidates: ReadonlyArray<SchedulingCandidateDecision>,
  runs: ReadonlyArray<SchedulingRunPolicyInput>,
): Readonly<{ candidate: SchedulingCandidateDecision; run: SchedulingRunPolicyInput }> | undefined {
  const runById = new Map(runs.map((run) => [run.runId, run] as const));
  const sorted = [...candidates].sort((left, right) => {
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
  });

  for (const candidate of sorted) {
    const run = runById.get(candidate.runId);
    if (run) {
      return Object.freeze({
        candidate,
        run,
      });
    }
  }

  return undefined;
}
