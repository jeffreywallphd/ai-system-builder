import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyAdministrationContractVersions,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyAdministrationSchemaValidationError,
  parseDeploymentPolicyAdminUpdateCommand,
  parseDeploymentPolicyAdministrationSnapshot,
  parseReadDeploymentPolicyAdministrationRequestDto,
  parseUpdateDeploymentPolicyAdministrationResponseDto,
} from "../DeploymentPolicyAdministrationSchemaContracts";

describe("DeploymentPolicyAdministrationSchemaContracts", () => {
  it("parses deployment policy read request and snapshot payloads", () => {
    const request = parseReadDeploymentPolicyAdministrationRequestDto({
      profileId: "organization",
      includeCatalog: true,
      includeValidation: false,
      asOf: "2026-04-07T18:00:00.000Z",
    });

    expect(request.profileId).toBe("organization");

    const snapshot = parseDeploymentPolicyAdministrationSnapshot({
      contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
      profileId: "organization",
      evaluatedAt: "2026-04-07T18:01:00.000Z",
      evaluationLayer: "application",
      preset: {
        profileId: "organization",
        parentProfileId: "classroom",
        lineage: ["home", "classroom", "organization"],
        inheritedFrom: ["home", "classroom"],
      },
      families: {
        "sharing-posture": {
          familyId: "sharing-posture",
          settings: {
            defaultWorkspaceVisibility: {
              familyId: "sharing-posture",
              settingKey: "defaultWorkspaceVisibility",
              controlMode: "profile-default-admin-overridable",
              value: "workspace",
              valueType: "string",
              source: "profile-preset",
            },
          },
        },
      },
      summary: {
        familyCount: 1,
        settingCount: 1,
        sourceCounts: {
          "profile-preset": 1,
          "policy-default": 0,
          "admin-state": 0,
        },
        controlModeCounts: {
          "profile-fixed": 0,
          "profile-default-admin-overridable": 1,
          "runtime-admin": 0,
        },
      },
    });

    expect(snapshot.summary.settingCount).toBe(1);
    expect(snapshot.preset.lineage).toEqual(["home", "classroom", "organization"]);
  });

  it("parses admin update command payloads", () => {
    const command = parseDeploymentPolicyAdminUpdateCommand({
      profileId: "classroom",
      actorUserIdentityId: "user:policy-admin",
      dryRun: true,
      expectedRevision: 12,
      submittedAt: "2026-04-07T18:05:00.000Z",
      operations: [
        {
          operation: "upsert",
          familyId: "approval-governance",
          settingKey: "approvalEscalationTimeoutMinutes",
          value: 30,
          valueType: "number",
          provenance: {
            actorUserIdentityId: "user:policy-admin",
            ticketReference: "CHG-1022",
          },
        },
      ],
    });

    expect(command.operations[0]?.settingKey).toBe("approvalEscalationTimeoutMinutes");
    expect(command.operations[0]?.valueType).toBe("number");
  });

  it("rejects inconsistent value typing and profile mismatches", () => {
    expect(() => parseDeploymentPolicyAdminUpdateCommand({
      profileId: "home",
      actorUserIdentityId: "user:1",
      operations: [
        {
          operation: "upsert",
          familyId: "sharing-posture",
          settingKey: "defaultWorkspaceVisibility",
          value: "workspace",
          valueType: "boolean",
        },
      ],
    })).toThrow(DeploymentPolicyAdministrationSchemaValidationError);

    expect(() => parseUpdateDeploymentPolicyAdministrationResponseDto({
      applied: true,
      profileId: "home",
      newRevision: 3,
      snapshot: {
        contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
        profileId: "classroom",
        evaluatedAt: "2026-04-07T18:10:00.000Z",
        evaluationLayer: "application",
        preset: {
          profileId: "classroom",
          parentProfileId: "home",
          lineage: ["home", "classroom"],
          inheritedFrom: ["home"],
        },
        families: {},
        summary: {
          familyCount: 0,
          settingCount: 0,
          sourceCounts: {
            "profile-preset": 0,
            "policy-default": 0,
            "admin-state": 0,
          },
          controlModeCounts: {
            "profile-fixed": 0,
            "profile-default-admin-overridable": 0,
            "runtime-admin": 0,
          },
        },
      },
      validation: {
        valid: true,
        issues: [],
        evaluatedAt: "2026-04-07T18:10:00.000Z",
      },
    })).toThrow(DeploymentPolicyAdministrationSchemaValidationError);
  });
});
