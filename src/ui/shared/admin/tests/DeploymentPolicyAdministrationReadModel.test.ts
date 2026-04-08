import { describe, expect, it } from "bun:test";
import {
  buildDeploymentPolicyAdministrationInspectionReadModel,
  toControlModeLabel,
} from "../DeploymentPolicyAdministrationReadModel";
import {
  DeploymentPolicyControlModes,
  DeploymentProfileIds,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyResolutionSources,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type { ReadDeploymentPolicyStateResponse } from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

describe("DeploymentPolicyAdministrationReadModel", () => {
  it("projects canonical policy state into grouped admin inspection rows with provenance", () => {
    const projected = buildDeploymentPolicyAdministrationInspectionReadModel(createResponseFixture());

    expect(projected.workspaceId).toBe("workspace-alpha");
    expect(projected.activeProfileId).toBe("organization");
    expect(projected.requestedProfileId).toBe("organization");
    expect(projected.policyGroups[0]?.familyId).toBe("approval-governance");
    expect(projected.presetComparisons).toHaveLength(3);

    const overrideSetting = projected.policyGroups
      .flatMap((group) => group.settings)
      .find((setting) => setting.settingKey === "highRiskDualApprovalRequired");
    expect(overrideSetting?.effectiveSource).toBe(DeploymentPolicyResolutionSources.adminState);
    expect(overrideSetting?.sourceLabel).toBe("Admin override");
    expect(overrideSetting?.provenanceSummary).toContain("security-admin");

    const presetSetting = projected.policyGroups
      .flatMap((group) => group.settings)
      .find((setting) => setting.settingKey === "defaultSharingVisibility");
    expect(presetSetting?.effectiveSource).toBe(DeploymentPolicyResolutionSources.profilePreset);
    expect(presetSetting?.provenanceSummary).toContain("preset lineage");

    const defaultSetting = projected.policyGroups
      .flatMap((group) => group.settings)
      .find((setting) => setting.settingKey === "auditRetentionDays");
    expect(defaultSetting?.effectiveSource).toBe(DeploymentPolicyResolutionSources.policyDefault);
    expect(defaultSetting?.sourceLabel).toBe("Policy default");
  });

  it("formats control-mode labels for admin display", () => {
    expect(toControlModeLabel(DeploymentPolicyControlModes.profileFixed)).toBe("Profile fixed");
    expect(toControlModeLabel(DeploymentPolicyControlModes.profileDefaultAdminOverridable)).toBe("Profile default (admin overridable)");
    expect(toControlModeLabel(DeploymentPolicyControlModes.runtimeAdmin)).toBe("Runtime admin");
  });
});

function createResponseFixture(): ReadDeploymentPolicyStateResponse {
  return Object.freeze({
    scope: Object.freeze({
      kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
      scopeId: "workspace-alpha",
    }),
    activeProfile: Object.freeze({
      profileId: DeploymentProfileIds.organization,
      source: "persisted-selection",
    }),
    snapshot: Object.freeze({
      contractVersion: "deployment-policy-administration/v1",
      profileId: DeploymentProfileIds.organization,
      evaluatedAt: "2026-04-08T10:00:00.000Z",
      evaluationLayer: "application",
      preset: Object.freeze({
        profileId: DeploymentProfileIds.organization,
        parentProfileId: DeploymentProfileIds.classroom,
        lineage: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom, DeploymentProfileIds.organization]),
        inheritedFrom: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom]),
      }),
      families: Object.freeze({
        "approval-governance": Object.freeze({
          familyId: "approval-governance",
          settings: Object.freeze({
            highRiskDualApprovalRequired: Object.freeze({
              familyId: "approval-governance",
              settingKey: "highRiskDualApprovalRequired",
              controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
              value: true,
              valueType: "boolean",
              source: DeploymentPolicyResolutionSources.adminState,
              adminOverrideProvenance: Object.freeze({
                actorUserIdentityId: "security-admin",
                updatedAt: "2026-04-08T09:55:00.000Z",
              }),
            }),
          }),
        }),
        "sharing-posture": Object.freeze({
          familyId: "sharing-posture",
          settings: Object.freeze({
            defaultSharingVisibility: Object.freeze({
              familyId: "sharing-posture",
              settingKey: "defaultSharingVisibility",
              controlMode: DeploymentPolicyControlModes.profileFixed,
              value: "workspace",
              valueType: "string",
              source: DeploymentPolicyResolutionSources.profilePreset,
            }),
          }),
        }),
        "audit-governance": Object.freeze({
          familyId: "audit-governance",
          settings: Object.freeze({
            auditRetentionDays: Object.freeze({
              familyId: "audit-governance",
              settingKey: "auditRetentionDays",
              controlMode: DeploymentPolicyControlModes.runtimeAdmin,
              value: 30,
              valueType: "number",
              source: DeploymentPolicyResolutionSources.policyDefault,
            }),
          }),
        }),
      }),
      summary: Object.freeze({
        familyCount: 3,
        settingCount: 3,
        sourceCounts: Object.freeze({
          "profile-preset": 1,
          "policy-default": 1,
          "admin-state": 1,
        }),
        controlModeCounts: Object.freeze({
          "profile-fixed": 1,
          "profile-default-admin-overridable": 1,
          "runtime-admin": 1,
        }),
      }),
    }),
    validation: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
      evaluatedAt: "2026-04-08T10:00:00.000Z",
    }),
    overrideRecords: Object.freeze([
      Object.freeze({
        scope: Object.freeze({
          kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeId: "workspace-alpha",
        }),
        profileId: DeploymentProfileIds.organization,
        familyId: "approval-governance",
        settingKey: "highRiskDualApprovalRequired",
        value: true,
        valueType: "boolean",
        provenance: Object.freeze({
          actorUserIdentityId: "security-admin",
          ticketReference: "CHG-441",
          reason: "Regulatory requirement",
          updatedAt: "2026-04-08T09:55:00.000Z",
        }),
        createdAt: "2026-04-08T09:55:00.000Z",
        createdBy: "security-admin",
        lastModifiedAt: "2026-04-08T09:55:00.000Z",
        lastModifiedBy: "security-admin",
        revision: 3,
      }),
    ]),
    catalog: Object.freeze({
      presets: Object.freeze({
        home: Object.freeze({
          profileId: DeploymentProfileIds.home,
          lineage: Object.freeze([DeploymentProfileIds.home]),
          inheritedFrom: Object.freeze([]),
          scope: "home",
          rationale: "Base defaults for local households.",
        }),
        classroom: Object.freeze({
          profileId: DeploymentProfileIds.classroom,
          parentProfileId: DeploymentProfileIds.home,
          lineage: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom]),
          inheritedFrom: Object.freeze([DeploymentProfileIds.home]),
          scope: "classroom",
          rationale: "Adds managed classroom controls.",
        }),
        organization: Object.freeze({
          profileId: DeploymentProfileIds.organization,
          parentProfileId: DeploymentProfileIds.classroom,
          lineage: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom, DeploymentProfileIds.organization]),
          inheritedFrom: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom]),
          scope: "organization",
          rationale: "Applies enterprise policy posture.",
        }),
      }),
      families: Object.freeze({
        "approval-governance": Object.freeze({
          familyId: "approval-governance",
          description: "Approval and risk controls",
          scope: "run-submission",
          settings: Object.freeze({
            highRiskDualApprovalRequired: Object.freeze({
              settingKey: "highRiskDualApprovalRequired",
              description: "Require dual approval for high-risk operations.",
              controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
              defaultValue: false,
              valueKind: "boolean",
              validationRules: undefined,
            }),
          }),
        }),
        "sharing-posture": Object.freeze({
          familyId: "sharing-posture",
          description: "Sharing and visibility defaults",
          scope: "sharing",
          settings: Object.freeze({
            defaultSharingVisibility: Object.freeze({
              settingKey: "defaultSharingVisibility",
              description: "Default sharing visibility.",
              controlMode: DeploymentPolicyControlModes.profileFixed,
              defaultValue: "private",
              valueKind: "string",
              validationRules: Object.freeze([
                Object.freeze({ type: "enum", allowedValues: Object.freeze(["private", "workspace", "public"]) }),
              ]),
            }),
          }),
        }),
        "audit-governance": Object.freeze({
          familyId: "audit-governance",
          description: "Audit retention controls",
          scope: "audit",
          settings: Object.freeze({
            auditRetentionDays: Object.freeze({
              settingKey: "auditRetentionDays",
              description: "Retention period in days.",
              controlMode: DeploymentPolicyControlModes.runtimeAdmin,
              defaultValue: 30,
              valueKind: "number",
              validationRules: Object.freeze([
                Object.freeze({ type: "number-range", min: 7, max: 365, integerOnly: true }),
              ]),
            }),
          }),
        }),
      }),
    }),
  });
}
