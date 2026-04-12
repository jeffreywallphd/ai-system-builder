import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyWriteSchemaValidationError,
  parseApplyDeploymentPolicyOverrideOperationsRequest,
  parseApplyDeploymentPolicyOverrideOperationsResponse,
  parseUpdateDeploymentPolicyActiveProfileRequest,
} from "../DeploymentPolicyWriteSchemaContracts";

describe("DeploymentPolicyWriteSchemaContracts", () => {
  it("parses active-profile write request payloads", () => {
    const parsed = parseUpdateDeploymentPolicyActiveProfileRequest({
      profileId: "organization",
      dryRun: false,
      occurredAt: "2026-04-08T00:00:00.000Z",
      reason: "Policy rollout",
      ticketReference: "CHG-2203",
      correlationId: "corr-2203",
    });

    expect(parsed.profileId).toBe("organization");
    expect(parsed.ticketReference).toBe("CHG-2203");
  });

  it("parses override write request payloads", () => {
    const parsed = parseApplyDeploymentPolicyOverrideOperationsRequest({
      profileId: "classroom",
      operations: [{
        operation: "upsert",
        familyId: "approval-governance",
        settingKey: "approvalEscalationTimeoutMinutes",
        value: 60,
        valueType: "number",
      }],
    });

    expect(parsed.operations[0]?.operation).toBe("upsert");
    expect(parsed.operations[0]?.valueType).toBe("number");
  });

  it("parses canonical override write responses", () => {
    const parsed = parseApplyDeploymentPolicyOverrideOperationsResponse({
      result: {
        scope: {
          kind: "deployment-policy-scope",
          scopeId: "workspace-alpha",
        },
        dryRun: false,
        validation: {
          valid: true,
          issues: [],
          evaluatedAt: "2026-04-08T00:00:00.000Z",
        },
        overrideMutations: [],
        snapshot: {
          contractVersion: "deployment-policy-administration/v1",
          profileId: "classroom",
          evaluatedAt: "2026-04-08T00:00:00.000Z",
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
      },
    });

    expect(parsed.result.scope.scopeId).toBe("workspace-alpha");
    expect(parsed.result.snapshot.profileId).toBe("classroom");
  });

  it("rejects malformed write requests", () => {
    expect(() => parseApplyDeploymentPolicyOverrideOperationsRequest({
      profileId: "home",
      operations: [{
        operation: "remove",
        familyId: "sharing-governance",
        settingKey: "workspaceDefaultVisibility",
        value: "workspace-members",
      }],
    })).toThrow(DeploymentPolicyWriteSchemaValidationError);
  });
});
