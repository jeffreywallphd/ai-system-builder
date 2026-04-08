import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyActiveProfileSourceKinds,
} from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import {
  DeploymentPolicyReadSchemaValidationError,
  parseReadDeploymentPolicyStateRequest,
  parseReadDeploymentPolicyStateResponse,
} from "../DeploymentPolicyReadSchemaContracts";

describe("DeploymentPolicyReadSchemaContracts", () => {
  it("parses canonical deployment policy read request payloads", () => {
    const parsed = parseReadDeploymentPolicyStateRequest({
      scope: {
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      },
      actorUserIdentityId: "user:admin",
      profileId: "organization",
      includeCatalog: true,
      includeOverrideRecords: true,
      includeEffectiveMetadata: true,
      evaluatedAt: "2026-04-07T20:00:00.000Z",
    });

    expect(parsed.scope.scopeId).toBe("workspace-alpha");
    expect(parsed.profileId).toBe("organization");
  });

  it("parses canonical deployment policy read response payloads", () => {
    const parsed = parseReadDeploymentPolicyStateResponse({
      scope: {
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      },
      activeProfile: {
        profileId: "classroom",
        source: DeploymentPolicyActiveProfileSourceKinds.persistedSelection,
      },
      snapshot: {
        contractVersion: "deployment-policy-administration/v1",
        profileId: "classroom",
        evaluatedAt: "2026-04-07T20:00:00.000Z",
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
        evaluatedAt: "2026-04-07T20:00:00.000Z",
      },
      overrideRecords: [],
    });

    expect(parsed.activeProfile.profileId).toBe("classroom");
    expect(parsed.snapshot.profileId).toBe("classroom");
  });

  it("rejects malformed read payloads", () => {
    expect(() => parseReadDeploymentPolicyStateRequest({
      scope: {
        kind: "deployment-policy-scope",
        scopeId: "",
      },
      actorUserIdentityId: "user:admin",
    })).toThrow(DeploymentPolicyReadSchemaValidationError);
  });
});
