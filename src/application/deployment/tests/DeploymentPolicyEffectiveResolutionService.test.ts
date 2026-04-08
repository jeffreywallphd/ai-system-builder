import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyEvaluationRequestLayers,
  DeploymentPolicyResolutionSources,
  resolveDeploymentPolicyAdministrationSnapshotWithOverrides,
} from "../DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyOverrideScopeKinds,
  validateDeploymentPolicyAdminOverrideRecords,
} from "../DeploymentPolicyEffectiveResolutionService";
import {
  DeploymentProfileIds,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

describe("DeploymentPolicyEffectiveResolutionService", () => {
  it("resolves deterministic effective values with override precedence and provenance metadata", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
      profileId: DeploymentProfileIds.classroom,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
      overrideRecords: [
        {
          profileId: DeploymentProfileIds.classroom,
          familyId: "approval-governance",
          settingKey: "runSubmissionApprovalMode",
          value: "owner-with-manual-review",
          provenance: {
            actorUserIdentityId: "user:admin-1",
            ticketReference: "CHG-2001",
          },
        },
        {
          profileId: DeploymentProfileIds.classroom,
          familyId: "approval-governance",
          settingKey: "runSubmissionApprovalMode",
          value: "owner-or-admin",
          provenance: {
            actorUserIdentityId: "user:admin-2",
            ticketReference: "CHG-2002",
          },
        },
      ],
    });

    const approvalMode = resolved.snapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode;
    expect(resolved.validation.valid).toBeTrue();
    expect(approvalMode?.value).toBe("owner-or-admin");
    expect(approvalMode?.source).toBe(DeploymentPolicyResolutionSources.adminState);
    expect(approvalMode?.adminOverrideProvenance?.actorUserIdentityId).toBe("user:admin-2");
    expect(approvalMode?.adminOverrideProvenance?.ticketReference).toBe("CHG-2002");
  });

  it("rejects invalid or out-of-scope override records through structured validation and excludes them", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
      profileId: DeploymentProfileIds.organization,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
      overrideRecords: [
        {
          profileId: DeploymentProfileIds.home,
          familyId: "approval-governance",
          settingKey: "runSubmissionApprovalMode",
          value: "self-or-owner",
        },
        {
          profileId: DeploymentProfileIds.organization,
          familyId: "sharing-posture",
          settingKey: "publicLinkSharingAllowed",
          value: true,
          overrideScope: {
            kind: DeploymentPolicyOverrideScopeKinds.deploymentProfile,
            profileId: DeploymentProfileIds.organization,
          },
        },
        {
          profileId: DeploymentProfileIds.organization,
          familyId: "storage-governance",
          settingKey: "retentionDaysDefault",
          value: 2,
        },
      ],
    });

    expect(resolved.validation.valid).toBeFalse();
    expect(resolved.validation.issues.map((issue) => issue.code)).toContain("override-scope-mismatch");
    expect(resolved.validation.issues.map((issue) => issue.code)).toContain("profile-fixed-override-denied");
    expect(resolved.validation.issues.map((issue) => issue.code)).toContain("invalid-value-kind");

    const approvalMode = resolved.snapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode;
    const retention = resolved.snapshot.families["storage-governance"]?.settings.retentionDaysDefault;
    expect(approvalMode?.value).toBe("owner-or-admin");
    expect(approvalMode?.source).toBe(DeploymentPolicyResolutionSources.profilePreset);
    expect(retention?.value).toBe(90);
    expect(retention?.source).toBe(DeploymentPolicyResolutionSources.policyDefault);
  });

  it("validates persisted override records into normalized admin state values", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const validation = validateDeploymentPolicyAdminOverrideRecords({
      profileId: DeploymentProfileIds.home,
      familyCatalog,
      evaluatedAt: "2026-04-08T00:00:00.000Z",
      overrideRecords: [
        {
          profileId: DeploymentProfileIds.home,
          familyId: "approval-governance",
          settingKey: "approvalEscalationTimeoutMinutes",
          value: 30,
        },
      ],
    });

    expect(validation.validation.valid).toBeTrue();
    expect(validation.state.values["approval-governance"]?.approvalEscalationTimeoutMinutes).toBe(30);
  });
});
