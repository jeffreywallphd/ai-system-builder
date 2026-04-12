import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyControlModes,
  DeploymentProfileIds,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyResolutionSources,
  createDeploymentPolicyCatalogShape,
  createDeploymentPolicyEffectiveSummary,
  createDeploymentPolicyProfilePresetMetadata,
  createDeploymentPolicyValidationOutcome,
  toDeploymentPolicyTypedValue,
} from "../DeploymentPolicyAdministrationContracts";

describe("DeploymentPolicyAdministrationContracts", () => {
  it("creates typed deployment policy values and policy catalog shapes", () => {
    const value = toDeploymentPolicyTypedValue(true);
    expect(value.kind).toBe("boolean");

    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const shape = createDeploymentPolicyCatalogShape({ familyCatalog });

    expect(shape["approval-governance"]).toContain("runSubmissionApprovalMode");
    expect(shape["sharing-posture"]).toContain("publicLinkSharingAllowed");
  });

  it("creates deployment profile preset metadata with lineage", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    const metadata = createDeploymentPolicyProfilePresetMetadata({
      profileId: DeploymentProfileIds.organization,
      presetCatalog,
    });

    expect(metadata.parentProfileId).toBe(DeploymentProfileIds.classroom);
    expect(metadata.lineage).toEqual([
      DeploymentProfileIds.home,
      DeploymentProfileIds.classroom,
      DeploymentProfileIds.organization,
    ]);
    expect(metadata.inheritedFrom).toEqual([
      DeploymentProfileIds.home,
      DeploymentProfileIds.classroom,
    ]);
  });

  it("summarizes effective policy settings by source and control mode", () => {
    const summary = createDeploymentPolicyEffectiveSummary({
      families: {
        "sharing-posture": {
          familyId: "sharing-posture",
          settings: {
            publicLinkSharingAllowed: {
              familyId: "sharing-posture",
              settingKey: "publicLinkSharingAllowed",
              controlMode: DeploymentPolicyControlModes.profileFixed,
              value: false,
              valueType: "boolean",
              source: DeploymentPolicyResolutionSources.profilePreset,
            },
            defaultWorkspaceVisibility: {
              familyId: "sharing-posture",
              settingKey: "defaultWorkspaceVisibility",
              controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
              value: "workspace",
              valueType: "string",
              source: DeploymentPolicyResolutionSources.adminState,
            },
            shareReviewWindowMinutes: {
              familyId: "sharing-posture",
              settingKey: "shareReviewWindowMinutes",
              controlMode: DeploymentPolicyControlModes.runtimeAdmin,
              value: 30,
              valueType: "number",
              source: DeploymentPolicyResolutionSources.policyDefault,
            },
          },
        },
      },
    });

    expect(summary.familyCount).toBe(1);
    expect(summary.settingCount).toBe(3);
    expect(summary.sourceCounts[DeploymentPolicyResolutionSources.profilePreset]).toBe(1);
    expect(summary.sourceCounts[DeploymentPolicyResolutionSources.policyDefault]).toBe(1);
    expect(summary.sourceCounts[DeploymentPolicyResolutionSources.adminState]).toBe(1);
    expect(summary.controlModeCounts[DeploymentPolicyControlModes.profileFixed]).toBe(1);
    expect(summary.controlModeCounts[DeploymentPolicyControlModes.profileDefaultAdminOverridable]).toBe(1);
    expect(summary.controlModeCounts[DeploymentPolicyControlModes.runtimeAdmin]).toBe(1);
  });

  it("creates valid and invalid validation outcomes", () => {
    const valid = createDeploymentPolicyValidationOutcome({
      evaluatedAt: "2026-04-07T16:00:00.000Z",
    });
    expect(valid.valid).toBeTrue();
    expect(valid.issues).toHaveLength(0);

    const invalid = createDeploymentPolicyValidationOutcome({
      issues: [
        {
          code: "unknown-setting",
          path: "operations[0].settingKey",
          message: "Unknown setting.",
        },
      ],
      evaluatedAt: "2026-04-07T16:05:00.000Z",
    });

    expect(invalid.valid).toBeFalse();
    expect(invalid.issues[0]?.code).toBe("unknown-setting");
  });
});
