import { describe, expect, it } from "bun:test";
import {
  DeploymentProfileIds,
  DeploymentProfilePolicyAdministrationDomainError,
  DeploymentPolicyControlModes,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
  createDeploymentPolicyFamilyCatalog,
  createDeploymentProfilePresetCatalog,
  normalizeDeploymentProfileId,
  resolveDeploymentProfilePresetPolicyValues,
} from "../DeploymentProfilePolicyAdministrationDomain";

describe("DeploymentProfilePolicyAdministrationDomain", () => {
  it("resolves canonical profile inheritance for home, classroom, and organization", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
    const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);

    const home = resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.home,
      presetCatalog,
    });
    const classroom = resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.classroom,
      presetCatalog,
    });
    const organization = resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.organization,
      presetCatalog,
    });

    expect(home["sharing-posture"]?.publicLinkSharingAllowed).toBe(true);
    expect(classroom["sharing-posture"]?.publicLinkSharingAllowed).toBe(false);
    expect(organization["sharing-posture"]?.publicLinkSharingAllowed).toBe(false);

    expect(classroom["approval-governance"]?.highRiskRunRequiresDualApproval).toBe(true);
    expect(organization["approval-governance"]?.highRiskRunRequiresDualApproval).toBe(true);
    expect(organization["storage-governance"]?.defaultStorageTier).toBe("server-managed");
  });

  it("rejects runtime-admin settings in profile preset overrides", () => {
    const familyCatalog = createDeploymentPolicyFamilyCatalog([
      {
        familyId: "audit-governance",
        description: "Audit governance family",
        settings: [
          {
            settingKey: "auditRetentionDays",
            description: "Retention period",
            controlMode: DeploymentPolicyControlModes.runtimeAdmin,
            defaultValue: 365,
          },
        ],
      },
    ]);

    expect(() => createDeploymentProfilePresetCatalog({
      familyCatalog,
      presets: [
        {
          profileId: DeploymentProfileIds.home,
          policyOverrides: {
            "audit-governance": {
              auditRetentionDays: 90,
            },
          },
        },
        {
          profileId: DeploymentProfileIds.classroom,
          parentProfileId: DeploymentProfileIds.home,
        },
        {
          profileId: DeploymentProfileIds.organization,
          parentProfileId: DeploymentProfileIds.classroom,
        },
      ],
    })).toThrow(DeploymentProfilePolicyAdministrationDomainError);
  });

  it("rejects cyclic preset inheritance", () => {
    const familyCatalog = createDeploymentPolicyFamilyCatalog([
      {
        familyId: "sharing-posture",
        description: "Sharing posture family",
        settings: [
          {
            settingKey: "publicLinkSharingAllowed",
            description: "Public-link posture",
            controlMode: DeploymentPolicyControlModes.profileFixed,
            defaultValue: false,
          },
        ],
      },
    ]);

    expect(() => createDeploymentProfilePresetCatalog({
      familyCatalog,
      presets: [
        {
          profileId: DeploymentProfileIds.home,
          parentProfileId: DeploymentProfileIds.organization,
        },
        {
          profileId: DeploymentProfileIds.classroom,
          parentProfileId: DeploymentProfileIds.home,
        },
        {
          profileId: DeploymentProfileIds.organization,
          parentProfileId: DeploymentProfileIds.classroom,
        },
      ],
    })).toThrow(DeploymentProfilePolicyAdministrationDomainError);
  });

  it("normalizes canonical deployment-profile ids and rejects unsupported values", () => {
    expect(normalizeDeploymentProfileId("deployment-profile:CLASSROOM")).toBe(DeploymentProfileIds.classroom);
    expect(() => normalizeDeploymentProfileId("enterprise")).toThrow(DeploymentProfilePolicyAdministrationDomainError);
  });
});
