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
} from "@domain/scheduling/SchedulingDomain";
import {
  DefaultSchedulingPolicyRules,
  RolePriorityQueueAgeSchedulingScorePolicy,
  SchedulingPolicyRulePipeline,
} from "./SchedulingPolicyRulePipeline";
import { applyBasicPlacementAffinityPreference } from "./SchedulingPlacementAffinityPreference";
import {
  createRolePrioritySchedulingArbitrationReason,
  selectRolePrioritySchedulingCandidate,
} from "./RolePrioritySchedulingArbitration";
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
    const affinityPreference = applyBasicPlacementAffinityPreference({
      eligibleCandidates,
      runs: snapshot.runs,
      nodes: snapshot.nodes,
    });
    const selected = selectRolePrioritySchedulingCandidate({
      eligibleCandidates: affinityPreference.eligibleCandidates,
      runs: snapshot.runs,
    });

    const reasons: SchedulingPolicyReason[] = [
      Object.freeze({
        code: "rule-pipeline-evaluated",
        message: "Scheduling policy rules were evaluated in configured order.",
        details: Object.freeze({
          ruleOrder: this.rulePipeline.getRuleOrder(),
          candidateCount: evaluatedCandidates.length,
          eligibleCandidateCount: eligibleCandidates.length,
          affinityPreferredCandidateCount: affinityPreference.eligibleCandidates.length,
        }),
      }),
    ];
    reasons.push(...affinityPreference.reasons);
    if (selected) {
      reasons.push(createRolePrioritySchedulingArbitrationReason({
        selected,
        eligibleCandidateCount: affinityPreference.eligibleCandidates.length,
      }));
    }

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
