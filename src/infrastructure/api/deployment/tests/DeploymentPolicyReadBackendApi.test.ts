import { describe, expect, it } from "bun:test";
import type { ReadDeploymentPolicyStateResponse } from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyReadBackendApi } from "../DeploymentPolicyReadBackendApi";

describe("DeploymentPolicyReadBackendApi", () => {
  it("returns canonical policy state payload for valid requests", async () => {
    const api = new DeploymentPolicyReadBackendApi({
      readDeploymentPolicyStateUseCase: {
        execute: async () => Object.freeze({
          scope: Object.freeze({
            kind: "deployment-policy-scope",
            scopeId: "workspace-alpha",
          }),
          activeProfile: Object.freeze({
            profileId: "home",
            source: "default-fallback",
          }),
          snapshot: Object.freeze({
            contractVersion: "deployment-policy-administration/v1",
            profileId: "home",
            evaluatedAt: "2026-04-07T20:30:00.000Z",
            evaluationLayer: "application",
            preset: Object.freeze({
              profileId: "home",
              lineage: Object.freeze(["home"]),
              inheritedFrom: Object.freeze([]),
            }),
            families: Object.freeze({}),
            summary: Object.freeze({
              familyCount: 0,
              settingCount: 0,
              sourceCounts: Object.freeze({
                "profile-preset": 0,
                "policy-default": 0,
                "admin-state": 0,
              }),
              controlModeCounts: Object.freeze({
                "profile-fixed": 0,
                "profile-default-admin-overridable": 0,
                "runtime-admin": 0,
              }),
            }),
          }),
          validation: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
            evaluatedAt: "2026-04-07T20:30:00.000Z",
          }),
          overrideRecords: Object.freeze([]),
        } satisfies ReadDeploymentPolicyStateResponse),
      } as never,
    });

    const response = await api.readPolicyState({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.scope.scopeId).toBe("workspace-alpha");
    expect(response.data?.snapshot.profileId).toBe("home");
  });

  it("returns invalid-request envelope for malformed input", async () => {
    const api = new DeploymentPolicyReadBackendApi({
      readDeploymentPolicyStateUseCase: {
        execute: async () => {
          throw new Error("unused");
        },
      } as never,
    });

    const response = await api.readPolicyState({
      actorUserIdentityId: "user:admin",
      workspaceId: "",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-request");
    expect(response.error?.validationErrors?.length).toBeGreaterThan(0);
  });
});
