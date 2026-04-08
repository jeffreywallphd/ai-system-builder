import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyEvaluationRequestLayers,
  DeploymentPolicyResolutionSources,
  evaluateDeploymentPolicyAdministrationSnapshot,
} from "../DeploymentPolicyAdministrationContracts";
import {
  DeploymentProfileIds,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

describe("Deployment policy effective defaults", () => {
  it("resolves explicit effective defaults for home, classroom, and organization across supported policy families", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    const homeSnapshot = evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: DeploymentProfileIds.home,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
    });
    const classroomSnapshot = evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: DeploymentProfileIds.classroom,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
    });
    const organizationSnapshot = evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: DeploymentProfileIds.organization,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(homeSnapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode?.value).toBe(
      "self-or-owner",
    );
    expect(classroomSnapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode?.value).toBe(
      "owner-or-instructor",
    );
    expect(organizationSnapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode?.value).toBe(
      "owner-or-admin",
    );

    expect(homeSnapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe("private");
    expect(classroomSnapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe(
      "workspace",
    );
    expect(organizationSnapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe(
      "workspace",
    );

    expect(homeSnapshot.families["storage-governance"]?.settings.defaultStorageTier?.value).toBe("local-managed");
    expect(classroomSnapshot.families["storage-governance"]?.settings.defaultStorageTier?.value).toBe(
      "workspace-managed",
    );
    expect(organizationSnapshot.families["storage-governance"]?.settings.defaultStorageTier?.value).toBe(
      "server-managed",
    );

    expect(homeSnapshot.families["security-governance"]?.settings.localCredentialRotationDays?.value).toBe(180);
    expect(classroomSnapshot.families["security-governance"]?.settings.localCredentialRotationDays?.value).toBe(120);
    expect(organizationSnapshot.families["security-governance"]?.settings.localCredentialRotationDays?.value).toBe(
      90,
    );

    expect(homeSnapshot.families["audit-governance"]?.settings.auditRetentionDays?.source).toBe(
      DeploymentPolicyResolutionSources.policyDefault,
    );
    expect(classroomSnapshot.families["audit-governance"]?.settings.auditRetentionDays?.source).toBe(
      DeploymentPolicyResolutionSources.policyDefault,
    );
    expect(organizationSnapshot.families["audit-governance"]?.settings.auditRetentionDays?.source).toBe(
      DeploymentPolicyResolutionSources.policyDefault,
    );
  });
});
