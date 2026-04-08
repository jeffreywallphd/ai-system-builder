import { describe, expect, it, mock } from "bun:test";
import { DeploymentPolicyAdministrationReadService } from "../DeploymentPolicyAdministrationReadService";
import {
  DeploymentPolicyControlModes,
  DeploymentProfileIds,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyResolutionSources,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type { ReadDeploymentPolicyStateResponse } from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

describe("DeploymentPolicyAdministrationReadService", () => {
  it("maps canonical state responses into admin inspection read models", async () => {
    const response = createResponseFixture();
    const service = new DeploymentPolicyAdministrationReadService({
      client: {
        readDeploymentPolicyState: mock(async () => Object.freeze({
          ok: true,
          data: response,
        })),
      },
    });

    const result = await service.readPolicyAdministrationState({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      request: Object.freeze({
        workspaceId: "workspace-alpha",
        profileId: "organization",
      }),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.data.policyState.scope.scopeId).toBe("workspace-alpha");
    expect(result.data.inspection.policyGroups).toHaveLength(1);
    expect(result.data.inspection.policyGroups[0]?.settings[0]?.sourceLabel).toBe("Admin override");
    expect(result.data.inspection.policyGroups[0]?.impactSummary).toContain("approval");
    expect(result.data.inspection.policyGroups[0]?.governanceSensitivity).toBe("governance-sensitive");
    expect(result.data.inspection.canMutateActiveProfile).toBeTrue();
  });

  it("returns stable failure when client rejects the request", async () => {
    const service = new DeploymentPolicyAdministrationReadService({
      client: {
        readDeploymentPolicyState: mock(async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "forbidden",
            message: "Not authorized.",
          }),
        })),
      },
    });

    const result = await service.readPolicyAdministrationState({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      request: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }

    expect(result.error.message).toBe("Not authorized.");
  });
});

function createResponseFixture(): ReadDeploymentPolicyStateResponse {
  return Object.freeze({
    scope: Object.freeze({
      kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
      scopeId: "workspace-alpha",
    }),
    authorization: Object.freeze({
      canReadState: true,
      canSelectActiveProfile: true,
      canManageOverrides: true,
      canManageRuntimeAdminOverrides: true,
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
            }),
          }),
        }),
      }),
      summary: Object.freeze({
        familyCount: 1,
        settingCount: 1,
        sourceCounts: Object.freeze({
          "profile-preset": 0,
          "policy-default": 0,
          "admin-state": 1,
        }),
        controlModeCounts: Object.freeze({
          "profile-fixed": 0,
          "profile-default-admin-overridable": 1,
          "runtime-admin": 0,
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
          updatedAt: "2026-04-08T09:55:00.000Z",
        }),
        createdAt: "2026-04-08T09:55:00.000Z",
        createdBy: "security-admin",
        lastModifiedAt: "2026-04-08T09:55:00.000Z",
        lastModifiedBy: "security-admin",
        revision: 2,
      }),
    ]),
    catalog: Object.freeze({
      presets: Object.freeze({
        home: Object.freeze({
          profileId: DeploymentProfileIds.home,
          lineage: Object.freeze([DeploymentProfileIds.home]),
          inheritedFrom: Object.freeze([]),
          scope: "home",
          rationale: "Household defaults.",
        }),
        classroom: Object.freeze({
          profileId: DeploymentProfileIds.classroom,
          parentProfileId: DeploymentProfileIds.home,
          lineage: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom]),
          inheritedFrom: Object.freeze([DeploymentProfileIds.home]),
          scope: "classroom",
          rationale: "Classroom defaults.",
        }),
        organization: Object.freeze({
          profileId: DeploymentProfileIds.organization,
          parentProfileId: DeploymentProfileIds.classroom,
          lineage: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom, DeploymentProfileIds.organization]),
          inheritedFrom: Object.freeze([DeploymentProfileIds.home, DeploymentProfileIds.classroom]),
          scope: "organization",
          rationale: "Enterprise governance defaults.",
        }),
      }),
      families: Object.freeze({
        "approval-governance": Object.freeze({
          familyId: "approval-governance",
          description: "Approval controls",
          scope: "run-submission",
          explainability: Object.freeze({
            behaviorSummary: "Current approval policy behavior across run-submission evaluation seams.",
            governanceSensitivity: "governance-sensitive",
            governedFeatureAreas: Object.freeze([
              Object.freeze({
                areaId: "run-submission-policy-evaluation",
                label: "Run submission policy decisions",
                currentBehavior: "Approval mode and escalation settings are returned by policy evaluation.",
              }),
            ]),
          }),
          settings: Object.freeze({
            highRiskDualApprovalRequired: Object.freeze({
              settingKey: "highRiskDualApprovalRequired",
              description: "Require dual approval for high risk.",
              controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
              defaultValue: false,
              valueKind: "boolean",
            }),
          }),
        }),
      }),
    }),
  });
}
