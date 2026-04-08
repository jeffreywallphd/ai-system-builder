import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyAdministrationContractsError,
  DeploymentPolicyEvaluationRequestLayers,
  DeploymentPolicyResolutionSources,
  createDeploymentPolicyAdministrationState,
  evaluateDeploymentPolicyAdministrationSnapshot,
} from "../DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyAdministrationContractVersions,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentProfileIds,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

describe("DeploymentPolicyAdministrationContracts", () => {
  it("resolves effective settings from profile presets, defaults, and admin state overrides", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);
    const adminState = createDeploymentPolicyAdministrationState({
      familyCatalog,
      values: {
        "approval-governance": {
          runSubmissionApprovalMode: "owner-with-manual-review",
          approvalEscalationTimeoutMinutes: 45,
        },
      },
    });

    const snapshot = evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: DeploymentProfileIds.classroom,
      familyCatalog,
      presetCatalog,
      adminState,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: "2026-04-07T16:00:00.000Z",
    });

    expect(snapshot.contractVersion).toBe(DeploymentPolicyAdministrationContractVersions.v1);
    expect(snapshot.preset.profileId).toBe(DeploymentProfileIds.classroom);
    expect(snapshot.summary.familyCount).toBe(Object.keys(snapshot.families).length);
    expect(snapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode?.value).toBe(
      "owner-with-manual-review",
    );
    expect(snapshot.families["approval-governance"]?.settings.runSubmissionApprovalMode?.source).toBe(
      DeploymentPolicyResolutionSources.adminState,
    );
    expect(snapshot.families["approval-governance"]?.settings.highRiskRunRequiresDualApproval?.value).toBe(true);
    expect(snapshot.families["approval-governance"]?.settings.highRiskRunRequiresDualApproval?.source).toBe(
      DeploymentPolicyResolutionSources.profilePreset,
    );
    expect(snapshot.families["approval-governance"]?.settings.approvalEscalationTimeoutMinutes?.value).toBe(45);
    expect(snapshot.families["approval-governance"]?.settings.approvalEscalationTimeoutMinutes?.source).toBe(
      DeploymentPolicyResolutionSources.adminState,
    );
    expect(snapshot.families["storage-governance"]?.settings.retentionDaysDefault?.source).toBe(
      DeploymentPolicyResolutionSources.policyDefault,
    );
  });

  it("blocks admin overrides for profile-fixed policy settings", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();

    expect(() => createDeploymentPolicyAdministrationState({
      familyCatalog,
      values: {
        "sharing-posture": {
          publicLinkSharingAllowed: true,
        },
      },
    })).toThrow(DeploymentPolicyAdministrationContractsError);
  });

  it("blocks policy evaluation from UI/transport/infrastructure layers", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    expect(() => evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: DeploymentProfileIds.organization,
      familyCatalog,
      presetCatalog,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.ui,
    })).toThrow(DeploymentPolicyAdministrationContractsError);
  });
});
