import {
  SchedulingCandidateDenialCodes,
  SchedulingRunPriorityBands,
  deriveSchedulingRunPriorityBand,
  evaluateHybridNodeLocalInteractiveProtection,
  type SchedulingCandidateDecision,
  type SchedulingNodePolicyInput,
  type SchedulingPolicyReason,
  type SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";
import type {
  ISchedulingCandidateScorePolicy,
  ISchedulingPolicyRule,
  SchedulingCandidatePolicyEvaluation,
  SchedulingPolicyRuleContext,
} from "@application/scheduling/ports/SchedulingPolicyRulePorts";

function toReason(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): SchedulingPolicyReason {
  return Object.freeze({
    code,
    message,
    details,
  });
}

function normalizeIso(value: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new Error("Scheduling policy-rule context requires a valid asOf ISO timestamp.");
  }
  return normalized;
}

function createCandidateDecision(input: {
  readonly run: SchedulingRunPolicyInput;
  readonly node: SchedulingNodePolicyInput;
  readonly score: ReturnType<ISchedulingCandidateScorePolicy["score"]>;
  readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
}): SchedulingCandidateDecision {
  return Object.freeze({
    runId: input.run.runId,
    nodeId: input.node.nodeId,
    eligible: input.reasons.length === 0,
    denialReasons: Object.freeze([...input.reasons]),
    scorecard: Object.freeze({
      priorityBand: input.score.priorityBand,
      rolePriorityScore: input.score.rolePriorityScore,
      queueAgeSeconds: input.score.queueAgeSeconds,
    }),
  });
}

export class RolePriorityQueueAgeSchedulingScorePolicy implements ISchedulingCandidateScorePolicy {
  public score(input: SchedulingPolicyRuleContext) {
    const asOf = normalizeIso(input.asOf);
    const priorityBand = deriveSchedulingRunPriorityBand(input.run.workspaceRoleKeys);
    const queueAgeSeconds = Math.max(
      0,
      Math.floor((Date.parse(asOf) - Date.parse(input.run.queue.enteredAt)) / 1000),
    );
    const rolePriorityScore = priorityBand === SchedulingRunPriorityBands.critical
      ? 4
      : priorityBand === SchedulingRunPriorityBands.high
        ? 3
        : priorityBand === SchedulingRunPriorityBands.normal
          ? 2
          : 1;

    return Object.freeze({
      priorityBand,
      rolePriorityScore,
      queueAgeSeconds,
    });
  }
}

export class NodeSchedulableSchedulingPolicyRule implements ISchedulingPolicyRule {
  public readonly ruleId = "node-schedulable";

  public evaluate(input: SchedulingPolicyRuleContext) {
    if (input.node.schedulable) {
      return Object.freeze({
        allowed: true,
        reasons: Object.freeze([]),
      });
    }

    return Object.freeze({
      allowed: false,
      reasons: Object.freeze([
        toReason(
          SchedulingCandidateDenialCodes.nodeNotSchedulable,
          `Node '${input.node.nodeId}' is not schedulable.`,
        ),
      ]),
    });
  }
}

export class NodeRequiredCapabilitiesSchedulingPolicyRule implements ISchedulingPolicyRule {
  public readonly ruleId = "node-required-capabilities";

  public evaluate(input: SchedulingPolicyRuleContext) {
    const nodeCapabilities = new Set(input.node.enabledCapabilities);
    const reasons: SchedulingPolicyReason[] = [];

    for (const capability of input.run.requirements.requiredCapabilities) {
      if (nodeCapabilities.has(capability)) {
        continue;
      }
      reasons.push(toReason(
        SchedulingCandidateDenialCodes.nodeMissingCapability,
        `Node '${input.node.nodeId}' is missing required capability '${capability}'.`,
        Object.freeze({
          requiredCapability: capability,
        }),
      ));
    }

    return Object.freeze({
      allowed: reasons.length === 0,
      reasons: Object.freeze(reasons),
    });
  }
}

export class RemoteSchedulingSupportPolicyRule implements ISchedulingPolicyRule {
  public readonly ruleId = "remote-scheduling-support";

  public evaluate(input: SchedulingPolicyRuleContext) {
    if (!input.run.requirements.requiresRemoteScheduling || input.node.supportsRemoteScheduling) {
      return Object.freeze({
        allowed: true,
        reasons: Object.freeze([]),
      });
    }

    return Object.freeze({
      allowed: false,
      reasons: Object.freeze([
        toReason(
          SchedulingCandidateDenialCodes.remoteSchedulingUnsupported,
          `Node '${input.node.nodeId}' does not support remote scheduling.`,
        ),
      ]),
    });
  }
}

export class HybridNodeLocalUseProtectionPolicyRule implements ISchedulingPolicyRule {
  public readonly ruleId = "hybrid-node-local-use-protection";

  public evaluate(input: SchedulingPolicyRuleContext) {
    const protection = evaluateHybridNodeLocalInteractiveProtection({
      asOf: input.asOf,
      nodeType: input.node.nodeType,
      nodeUsageMode: input.node.usageMode,
      localInteractiveOwnerUserIdentityId: input.node.localInteractiveOwnerUserIdentityId,
      runSubmittedByUserIdentityId: input.run.submittedByUserIdentityId,
      hybridLocalUseProtection: input.node.hybridLocalUseProtection,
    });

    return Object.freeze({
      allowed: protection.allowed,
      reasons: protection.allowed || !protection.reason
        ? Object.freeze([])
        : Object.freeze([protection.reason]),
    });
  }
}

export class ReservationOwnershipPolicyRule implements ISchedulingPolicyRule {
  public readonly ruleId = "reservation-ownership";

  public evaluate(input: SchedulingPolicyRuleContext) {
    if (!input.node.reservationOwner || input.node.reservationOwner === input.run.queue.claimOwner) {
      return Object.freeze({
        allowed: true,
        reasons: Object.freeze([]),
      });
    }

    return Object.freeze({
      allowed: false,
      reasons: Object.freeze([
        toReason(
          SchedulingCandidateDenialCodes.reservationConflict,
          `Node '${input.node.nodeId}' is reserved by another scheduling owner.`,
          Object.freeze({
            reservationOwner: input.node.reservationOwner,
            claimOwner: input.run.queue.claimOwner,
          }),
        ),
      ]),
    });
  }
}

export const DefaultSchedulingPolicyRules = Object.freeze([
  new NodeSchedulableSchedulingPolicyRule(),
  new NodeRequiredCapabilitiesSchedulingPolicyRule(),
  new RemoteSchedulingSupportPolicyRule(),
  new HybridNodeLocalUseProtectionPolicyRule(),
  new ReservationOwnershipPolicyRule(),
]) satisfies ReadonlyArray<ISchedulingPolicyRule>;

export class SchedulingPolicyRulePipeline {
  public constructor(
    private readonly scorePolicy: ISchedulingCandidateScorePolicy,
    private readonly rules: ReadonlyArray<ISchedulingPolicyRule>,
  ) {}

  public getRuleOrder(): ReadonlyArray<string> {
    return Object.freeze(this.rules.map((rule) => rule.ruleId));
  }

  public async evaluateCandidate(input: {
    readonly asOf: string;
    readonly run: SchedulingRunPolicyInput;
    readonly node: SchedulingNodePolicyInput;
  }): Promise<SchedulingCandidatePolicyEvaluation> {
    const context: SchedulingPolicyRuleContext = Object.freeze({
      asOf: normalizeIso(input.asOf),
      run: input.run,
      node: input.node,
    });

    const score = this.scorePolicy.score(context);
    const denialReasons: SchedulingPolicyReason[] = [];
    const ruleOutcomes: Array<{
      readonly ruleId: string;
      readonly allowed: boolean;
      readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
    }> = [];

    for (const rule of this.rules) {
      const outcome = await rule.evaluate(context);
      if (!outcome.allowed && outcome.reasons.length > 0) {
        denialReasons.push(...outcome.reasons);
      }
      ruleOutcomes.push(Object.freeze({
        ruleId: rule.ruleId,
        allowed: outcome.allowed,
        reasons: Object.freeze([...outcome.reasons]),
      }));
    }

    return Object.freeze({
      candidate: createCandidateDecision({
        run: input.run,
        node: input.node,
        score,
        reasons: denialReasons,
      }),
      ruleOutcomes: Object.freeze(ruleOutcomes),
    });
  }
}
