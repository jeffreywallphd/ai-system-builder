import { describe, expect, it } from "bun:test";
import { DeploymentProfileIds } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import { CanonicalDeploymentPolicySnapshotResolver } from "../CanonicalDeploymentPolicySnapshotResolver";
import { DeploymentPolicyEvaluationService } from "../DeploymentPolicyEvaluationService";
import type {
  IDeploymentAuthorizationPolicyEvaluationPort,
  IDeploymentSchedulingPolicyEvaluationPort,
  IDeploymentSecurityPolicyEvaluationPort,
  IDeploymentStoragePolicyEvaluationPort,
} from "../DeploymentPolicyEvaluationPorts";

describe("DeploymentPolicyEvaluationService contracts", () => {
  it("supports authorization, storage, scheduling, and security consumers through explicit interfaces", async () => {
    const service = new DeploymentPolicyEvaluationService(new CanonicalDeploymentPolicySnapshotResolver());

    const authorization = await evaluateAuthorizationSeam(service);
    expect(authorization.defaultWorkspaceVisibility).toBe("workspace");

    const storage = await evaluateStorageSeam(service);
    expect(storage.defaultStorageTier).toBe("server-managed");

    const scheduling = await evaluateSchedulingSeam(service);
    expect(scheduling.runSubmissionApprovalMode).toBe("owner-or-admin");

    const security = await evaluateSecuritySeam(service);
    expect(security.transportTlsRequired).toBeTrue();
  });
});

async function evaluateAuthorizationSeam(port: IDeploymentAuthorizationPolicyEvaluationPort): Promise<{
  readonly defaultWorkspaceVisibility: string;
}> {
  const decision = await port.evaluateAuthorizationPolicy({
    profileId: DeploymentProfileIds.classroom,
  });
  return Object.freeze({
    defaultWorkspaceVisibility: decision.defaultWorkspaceVisibility.value,
  });
}

async function evaluateStorageSeam(port: IDeploymentStoragePolicyEvaluationPort): Promise<{
  readonly defaultStorageTier: string;
}> {
  const decision = await port.evaluateStoragePolicy({
    profileId: DeploymentProfileIds.organization,
  });
  return Object.freeze({
    defaultStorageTier: decision.defaultStorageTier.value,
  });
}

async function evaluateSchedulingSeam(port: IDeploymentSchedulingPolicyEvaluationPort): Promise<{
  readonly runSubmissionApprovalMode: string;
}> {
  const decision = await port.evaluateSchedulingPolicy({
    profileId: DeploymentProfileIds.organization,
  });
  return Object.freeze({
    runSubmissionApprovalMode: decision.runSubmissionApprovalMode.value,
  });
}

async function evaluateSecuritySeam(port: IDeploymentSecurityPolicyEvaluationPort): Promise<{
  readonly transportTlsRequired: boolean;
}> {
  const decision = await port.evaluateSecurityPolicy({
    profileId: DeploymentProfileIds.home,
  });
  return Object.freeze({
    transportTlsRequired: decision.transportTlsRequired.value,
  });
}
