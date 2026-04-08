import type {
  DeploymentPolicyAdministrationSnapshot,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentAuditAndAdminPolicyDecision,
  DeploymentAuthorizationPolicyDecision,
  DeploymentPolicyEvaluatedSetting,
  DeploymentPolicyEvaluationContext,
  DeploymentPolicyEvaluationSettingPath,
  DeploymentPolicySettingValueByPath,
  DeploymentSchedulingPolicyDecision,
  DeploymentSecurityPolicyDecision,
  DeploymentStoragePolicyDecision,
} from "./DeploymentPolicyEvaluationContracts";

export interface IDeploymentPolicyEvaluationSnapshotResolverPort {
  resolveSnapshot(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentPolicyAdministrationSnapshot> | DeploymentPolicyAdministrationSnapshot;
}

export interface IDeploymentPolicySettingReadPort {
  evaluateSetting<TKey extends DeploymentPolicyEvaluationSettingPath>(input: {
    readonly context: DeploymentPolicyEvaluationContext;
    readonly path: TKey;
  }): Promise<DeploymentPolicyEvaluatedSetting<DeploymentPolicySettingValueByPath[TKey]>>;
}

export interface IDeploymentAuthorizationPolicyEvaluationPort {
  evaluateAuthorizationPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentAuthorizationPolicyDecision>;
}

export interface IDeploymentStoragePolicyEvaluationPort {
  evaluateStoragePolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentStoragePolicyDecision>;
}

export interface IDeploymentSchedulingPolicyEvaluationPort {
  evaluateSchedulingPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentSchedulingPolicyDecision>;
}

export interface IDeploymentSecurityPolicyEvaluationPort {
  evaluateSecurityPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentSecurityPolicyDecision>;
}

export interface IDeploymentAuditAndAdminPolicyEvaluationPort {
  evaluateAuditAndAdminPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentAuditAndAdminPolicyDecision>;
}

export interface IDeploymentPolicyEvaluationService
  extends IDeploymentPolicySettingReadPort,
  IDeploymentAuthorizationPolicyEvaluationPort,
  IDeploymentStoragePolicyEvaluationPort,
  IDeploymentSchedulingPolicyEvaluationPort,
  IDeploymentSecurityPolicyEvaluationPort,
  IDeploymentAuditAndAdminPolicyEvaluationPort {}
