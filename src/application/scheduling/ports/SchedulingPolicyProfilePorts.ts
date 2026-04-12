import type { SchedulingEvaluationSnapshot } from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type {
  SchedulingQueueLease,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import type {
  SchedulingNodePolicyInput,
  SchedulingPolicySourceKind,
  SchedulingRunPolicyInput,
} from "@domain/scheduling/SchedulingDomain";
import type { ISchedulingCandidateScorePolicy, ISchedulingPolicyRule } from "./SchedulingPolicyRulePorts";

export interface SchedulingPolicyRuleSetDefinition {
  readonly scorePolicy?: ISchedulingCandidateScorePolicy;
  readonly rules?: ReadonlyArray<ISchedulingPolicyRule>;
  readonly policySources?: ReadonlyArray<SchedulingPolicySourceKind>;
}

export interface ISchedulingPolicyRuleSetProvider {
  resolveRuleSet(input: {
    readonly snapshot: SchedulingEvaluationSnapshot;
  }): SchedulingPolicyRuleSetDefinition | Promise<SchedulingPolicyRuleSetDefinition>;
}

export interface SchedulingDeploymentProfilePolicyContext {
  readonly deploymentProfileId?: string;
}

export interface ISchedulingDeploymentProfilePolicyContextPort {
  resolveDeploymentProfilePolicyContext(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly workspaceId?: string;
    readonly queueLeases: ReadonlyArray<SchedulingQueueLease>;
    readonly runs: ReadonlyArray<SchedulingRunPolicyInput>;
    readonly nodes: ReadonlyArray<SchedulingNodePolicyInput>;
  }): Promise<SchedulingDeploymentProfilePolicyContext | undefined>
    | SchedulingDeploymentProfilePolicyContext
    | undefined;
}
