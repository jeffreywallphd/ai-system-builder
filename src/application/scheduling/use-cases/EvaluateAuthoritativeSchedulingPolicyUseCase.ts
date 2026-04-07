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
  type SchedulingPolicySourceKind,
} from "@domain/scheduling/SchedulingDomain";
import {
  DefaultSchedulingPolicyRules,
  RolePriorityQueueAgeSchedulingScorePolicy,
  SchedulingPolicyRulePipeline,
} from "./SchedulingPolicyRulePipeline";
import { applyBasicPlacementAffinityPreference } from "./SchedulingPlacementAffinityPreference";
import {
  compareRolePrioritySchedulingCandidates,
  createRolePrioritySchedulingArbitrationReason,
  orderRolePrioritySchedulingCandidates,
  selectRolePrioritySchedulingCandidate,
} from "./RolePrioritySchedulingArbitration";
import type {
  ISchedulingCandidateScorePolicy,
  ISchedulingPolicyRule,
} from "@application/scheduling/ports/SchedulingPolicyRulePorts";
import type {
  ISchedulingPolicyRuleSetProvider,
  SchedulingPolicyRuleSetDefinition,
} from "@application/scheduling/ports/SchedulingPolicyProfilePorts";

interface EvaluateAuthoritativeSchedulingPolicyUseCaseDependencies {
  readonly now?: () => Date;
  readonly decisionIdFactory?: () => string;
  readonly scorePolicy?: ISchedulingCandidateScorePolicy;
  readonly rules?: ReadonlyArray<ISchedulingPolicyRule>;
  readonly ruleSetProvider?: ISchedulingPolicyRuleSetProvider;
}

export class EvaluateAuthoritativeSchedulingPolicyUseCase implements IAuthoritativeSchedulingPolicyEvaluator {
  private readonly now: () => Date;
  private readonly decisionIdFactory: () => string;
  private readonly defaultScorePolicy: ISchedulingCandidateScorePolicy;
  private readonly defaultRules: ReadonlyArray<ISchedulingPolicyRule>;
  private readonly ruleSetProvider?: ISchedulingPolicyRuleSetProvider;

  public constructor(dependencies: EvaluateAuthoritativeSchedulingPolicyUseCaseDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.decisionIdFactory = dependencies.decisionIdFactory ?? (() => randomUUID());
    this.defaultScorePolicy = dependencies.scorePolicy ?? new RolePriorityQueueAgeSchedulingScorePolicy();
    this.defaultRules = dependencies.rules ?? DefaultSchedulingPolicyRules;
    this.ruleSetProvider = dependencies.ruleSetProvider;
  }

  public async evaluate(snapshot: SchedulingEvaluationSnapshot): Promise<SchedulingDecisionBundle> {
    const occurredAt = this.now().toISOString();
    const resolvedRuleSet = await this.resolveRuleSet(snapshot);
    const rulePipeline = new SchedulingPolicyRulePipeline(
      resolvedRuleSet.scorePolicy ?? this.defaultScorePolicy,
      resolvedRuleSet.rules ?? this.defaultRules,
    );
    const evaluatedCandidates = await this.evaluateCandidates(snapshot, rulePipeline);
    const orderedEvaluatedCandidates = orderRolePrioritySchedulingCandidates(evaluatedCandidates);
    const eligibleCandidates = orderedEvaluatedCandidates.filter((candidate) => candidate.eligible);
    const affinityPreference = applyBasicPlacementAffinityPreference({
      eligibleCandidates,
      runs: snapshot.runs,
      nodes: snapshot.nodes,
    });
    const rankedCandidates = orderRolePrioritySchedulingCandidates(affinityPreference.eligibleCandidates);
    const selected = selectRolePrioritySchedulingCandidate({
      eligibleCandidates: rankedCandidates,
      runs: snapshot.runs,
    });

    const reasons: SchedulingPolicyReason[] = [
      Object.freeze({
        code: "rule-pipeline-evaluated",
        message: "Scheduling policy rules were evaluated in configured order.",
        details: Object.freeze({
          ruleOrder: rulePipeline.getRuleOrder(),
          candidateCount: orderedEvaluatedCandidates.length,
          eligibleCandidateCount: eligibleCandidates.length,
          affinityPreferredCandidateCount: rankedCandidates.length,
        }),
      }),
    ];
    reasons.push(...affinityPreference.reasons);
    if (selected) {
      reasons.push(createRolePrioritySchedulingArbitrationReason({
        selected,
        eligibleCandidateCount: rankedCandidates.length,
        rankedCandidates,
      }));
    }

    let outcome = SchedulingDecisionOutcomes.assignmentRecommended;
    if (snapshot.queueLeases.length === 0 || snapshot.runs.length === 0) {
      outcome = SchedulingDecisionOutcomes.deferred;
      reasons.push(createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.queueEmpty,
        "No scheduling candidates were available for evaluation.",
      ));
    } else if (orderedEvaluatedCandidates.length === 0) {
      outcome = SchedulingDecisionOutcomes.noPlacement;
      reasons.push(createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.noPlacement,
        "Queued runs could not be evaluated against any eligible nodes.",
      ));
    } else if (!selected) {
      outcome = SchedulingDecisionOutcomes.noPlacement;
      reasons.push(createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.noEligibleCandidates,
        "Scheduling candidates were evaluated, but none were eligible for assignment.",
      ));
    }

    const basePolicySources = Object.freeze([
      SchedulingPolicySourceKinds.runSubmission,
      SchedulingPolicySourceKinds.workspaceMembershipRoles,
      SchedulingPolicySourceKinds.nodeTrustInventory,
      SchedulingPolicySourceKinds.activeReservations,
      ...(snapshot.deploymentProfileId ? [SchedulingPolicySourceKinds.deploymentProfile] : []),
    ]);
    const policySources = collectPolicySources({
      basePolicySources,
      extendedPolicySources: resolvedRuleSet.policySources,
    });

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
      evaluatedCandidates: orderedEvaluatedCandidates,
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

  private async resolveRuleSet(snapshot: SchedulingEvaluationSnapshot): Promise<SchedulingPolicyRuleSetDefinition> {
    if (!this.ruleSetProvider) {
      return Object.freeze({});
    }
    return this.ruleSetProvider.resolveRuleSet({
      snapshot,
    });
  }

  private async evaluateCandidates(
    snapshot: SchedulingEvaluationSnapshot,
    rulePipeline: SchedulingPolicyRulePipeline,
  ): Promise<ReadonlyArray<SchedulingCandidateDecision>> {
    const results: SchedulingCandidateDecision[] = [];
    const orderedRuns = [...snapshot.runs].sort((left, right) => left.runId.localeCompare(right.runId));
    const orderedNodes = [...snapshot.nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId));

    for (const run of orderedRuns) {
      for (const node of orderedNodes) {
        const evaluated = await rulePipeline.evaluateCandidate({
          asOf: snapshot.asOf,
          run,
          node,
        });
        results.push(evaluated.candidate);
      }
    }

    return Object.freeze(results.sort(compareRolePrioritySchedulingCandidates));
  }
}

function collectPolicySources(input: {
  readonly basePolicySources: ReadonlyArray<SchedulingPolicySourceKind>;
  readonly extendedPolicySources?: ReadonlyArray<SchedulingPolicySourceKind>;
}): ReadonlyArray<SchedulingPolicySourceKind> {
  return Object.freeze([
    ...new Set([
      ...input.basePolicySources,
      ...(input.extendedPolicySources ?? []),
    ]),
  ]);
}
