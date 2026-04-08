import { describe, expect, it } from "bun:test";
import { createCanonicalDeploymentPolicyFamilyCatalog } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyReadTransportRoutes,
  toDeploymentPolicyFamilyMetadataReadModel,
} from "../DeploymentPolicyReadContracts";

describe("DeploymentPolicyReadContracts", () => {
  it("defines canonical authoritative deployment policy read route", () => {
    expect(DeploymentPolicyReadTransportRoutes.readState).toBe("/api/v1/deployment/policy/state");
  });

  it("projects family catalog metadata into stable read-model shape", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const approval = toDeploymentPolicyFamilyMetadataReadModel(familyCatalog["approval-governance"]!);

    expect(approval.familyId).toBe("approval-governance");
    expect(approval.explainability?.governanceSensitivity).toBe("governance-sensitive");
    expect(approval.explainability?.governedFeatureAreas.length).toBeGreaterThan(0);
    expect(approval.settings.runSubmissionApprovalMode?.valueKind).toBe("string");
    expect(approval.settings.highRiskRunRequiresDualApproval?.controlMode).toBe("profile-fixed");
  });
});
