import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyFamilyScopes,
  DeploymentProfileIds,
  DeploymentProfilePolicyAdministrationDomainError,
  DeploymentPolicyControlModes,
  createCanonicalDeploymentPolicyConfigurationRegistry,
  createCanonicalDeploymentPolicyFamilyCatalog,
  createCanonicalDeploymentProfilePresetCatalog,
  createDeploymentPolicyFamilyCatalog,
  createDeploymentProfilePresetCatalog,
  normalizeDeploymentProfileId,
  resolveDeploymentProfilePresetPolicyValues,
  resolveDeploymentPolicySettingDefinition,
  validateDeploymentPolicySettingValue,
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

  it("defines first-production policy families with explicit scopes and validation rules", () => {
    const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();

    expect(familyCatalog["approval-governance"]?.scope).toBe(DeploymentPolicyFamilyScopes.runSubmission);
    expect(familyCatalog["sharing-posture"]?.scope).toBe(DeploymentPolicyFamilyScopes.sharing);
    expect(familyCatalog["storage-governance"]?.scope).toBe(DeploymentPolicyFamilyScopes.storage);
    expect(familyCatalog["security-governance"]?.scope).toBe(DeploymentPolicyFamilyScopes.security);
    expect(familyCatalog["admin-controls"]?.scope).toBe(DeploymentPolicyFamilyScopes.administration);
    expect(familyCatalog["audit-governance"]?.scope).toBe(DeploymentPolicyFamilyScopes.audit);

    const visibilitySetting = resolveDeploymentPolicySettingDefinition({
      familyCatalog,
      familyId: "sharing-posture",
      settingKey: "defaultWorkspaceVisibility",
    });
    const invalidVisibilityIssues = validateDeploymentPolicySettingValue({
      settingDefinition: visibilitySetting,
      value: "global",
    });
    expect(invalidVisibilityIssues[0]?.code).toBe("disallowed-value");

    const retentionSetting = resolveDeploymentPolicySettingDefinition({
      familyCatalog,
      familyId: "storage-governance",
      settingKey: "retentionDaysDefault",
    });
    const invalidRetentionIssues = validateDeploymentPolicySettingValue({
      settingDefinition: retentionSetting,
      value: 2,
    });
    expect(invalidRetentionIssues[0]?.code).toBe("out-of-range");
  });

  it("builds a canonical registry with profile-default relationships", () => {
    const registry = createCanonicalDeploymentPolicyConfigurationRegistry();

    expect(registry.profileDefaults.home?.["sharing-posture"]?.defaultWorkspaceVisibility).toBe("private");
    expect(registry.profileDefaults.classroom?.["sharing-posture"]?.defaultWorkspaceVisibility).toBe("workspace");
    expect(registry.profileDefaults.organization?.["storage-governance"]?.defaultStorageTier).toBe("server-managed");
    expect(registry.profileDefaults.organization?.["approval-governance"]?.highRiskRunRequiresDualApproval).toBe(true);
  });
});
