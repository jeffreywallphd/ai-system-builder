import type {
  SchedulingCandidateDecision,
  SchedulingCandidateScorecard,
  SchedulingNodePolicyInput,
  SchedulingPolicyReason,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";

export interface SchedulingPolicyRuleContext {
  readonly asOf: string;
  readonly run: SchedulingRunPolicyInput;
  readonly node: SchedulingNodePolicyInput;
}

export interface SchedulingPolicyRuleResult {
  readonly allowed: boolean;
  readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
}

export interface ISchedulingPolicyRule {
  readonly ruleId: string;
  evaluate(input: SchedulingPolicyRuleContext): SchedulingPolicyRuleResult | Promise<SchedulingPolicyRuleResult>;
}

export interface ISchedulingCandidateScorePolicy {
  score(input: SchedulingPolicyRuleContext): SchedulingCandidateScorecard;
}

export interface SchedulingCandidatePolicyEvaluation {
  readonly candidate: SchedulingCandidateDecision;
  readonly ruleOutcomes: ReadonlyArray<Readonly<{
    readonly ruleId: string;
    readonly allowed: boolean;
    readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
  }>>;
}
