import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyFamilyIds,
  DeploymentProfileIds,
  createCanonicalDeploymentProfilePresetDefinitions,
} from "../DeploymentProfilePolicyAdministrationDomain";

const expectedFamilyIds = [
  DeploymentPolicyFamilyIds.approvalGovernance,
  DeploymentPolicyFamilyIds.sharingPosture,
  DeploymentPolicyFamilyIds.storageGovernance,
  DeploymentPolicyFamilyIds.securityGovernance,
  DeploymentPolicyFamilyIds.adminControls,
  DeploymentPolicyFamilyIds.auditGovernance,
].sort();

describe("Deployment profile preset definitions", () => {
  it("provides canonical home, classroom, and organization preset definitions with rationale metadata", () => {
    const presets = createCanonicalDeploymentProfilePresetDefinitions();

    expect(Object.keys(presets).sort()).toEqual([
      DeploymentProfileIds.classroom,
      DeploymentProfileIds.home,
      DeploymentProfileIds.organization,
    ]);

    expect(presets.home.scope.length).toBeGreaterThan(0);
    expect(presets.home.rationale.length).toBeGreaterThan(0);
    expect(presets.classroom.scope.length).toBeGreaterThan(0);
    expect(presets.classroom.rationale.length).toBeGreaterThan(0);
    expect(presets.organization.scope.length).toBeGreaterThan(0);
    expect(presets.organization.rationale.length).toBeGreaterThan(0);
  });

  it("maps each canonical preset to explicit defaults for all supported policy families", () => {
    const presets = createCanonicalDeploymentProfilePresetDefinitions();

    expect(Object.keys(presets.home.policyOverrides).sort()).toEqual(expectedFamilyIds);
    expect(Object.keys(presets.classroom.policyOverrides).sort()).toEqual(expectedFamilyIds);
    expect(Object.keys(presets.organization.policyOverrides).sort()).toEqual(expectedFamilyIds);
  });

  it("keeps differences between home, classroom, and organization presets explicit and testable", () => {
    const presets = createCanonicalDeploymentProfilePresetDefinitions();

    expect(presets.home.policyOverrides["sharing-posture"]?.publicLinkSharingAllowed).toBe(true);
    expect(presets.classroom.policyOverrides["sharing-posture"]?.publicLinkSharingAllowed).toBe(false);
    expect(presets.organization.policyOverrides["sharing-posture"]?.publicLinkSharingAllowed).toBe(false);

    expect(presets.home.policyOverrides["approval-governance"]?.runSubmissionApprovalMode).toBe("self-or-owner");
    expect(presets.classroom.policyOverrides["approval-governance"]?.runSubmissionApprovalMode).toBe(
      "owner-or-instructor",
    );
    expect(presets.organization.policyOverrides["approval-governance"]?.runSubmissionApprovalMode).toBe(
      "owner-or-admin",
    );

    expect(presets.home.policyOverrides["storage-governance"]?.defaultStorageTier).toBe("local-managed");
    expect(presets.classroom.policyOverrides["storage-governance"]?.defaultStorageTier).toBe("workspace-managed");
    expect(presets.organization.policyOverrides["storage-governance"]?.defaultStorageTier).toBe("server-managed");
  });
});
