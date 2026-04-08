import { describe, expect, it } from "bun:test";
import { DeploymentPolicyWriteBackendApi } from "../DeploymentPolicyWriteBackendApi";

describe("DeploymentPolicyWriteBackendApi", () => {
  it("returns canonical response envelope after active profile update", async () => {
    const useCase = {
      execute: async () => Object.freeze({
        ok: true as const,
        value: Object.freeze({
          scope: Object.freeze({
            kind: "deployment-policy-scope",
            scopeId: "workspace-alpha",
          }),
          dryRun: false,
          validation: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
            evaluatedAt: "2026-04-08T00:00:00.000Z",
          }),
          overrideMutations: Object.freeze([]),
          snapshot: Object.freeze({
            contractVersion: "deployment-policy-administration/v1",
            profileId: "organization",
            evaluatedAt: "2026-04-08T00:00:00.000Z",
            evaluationLayer: "application",
            preset: Object.freeze({
              profileId: "organization",
              lineage: Object.freeze(["home", "classroom", "organization"]),
              inheritedFrom: Object.freeze(["home", "classroom"]),
              parentProfileId: "classroom",
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
        }),
      }),
    };
    const api = new DeploymentPolicyWriteBackendApi({
      updateDeploymentPolicyStateUseCase: useCase as never,
    });

    const response = await api.updateActiveProfile(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: "workspace-alpha",
      }),
      Object.freeze({
        profileId: "organization",
      }),
    );

    expect(response.ok).toBeTrue();
    expect(response.data?.result.scope.scopeId).toBe("workspace-alpha");
    expect(response.data?.result.snapshot.profileId).toBe("organization");
  });

  it("returns invalid-request when override payload is malformed", async () => {
    const api = new DeploymentPolicyWriteBackendApi({
      updateDeploymentPolicyStateUseCase: {
        execute: async () => {
          throw new Error("unreachable");
        },
      } as never,
    });

    const response = await api.applyOverrideOperations(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: "workspace-alpha",
      }),
      Object.freeze({
        profileId: "home",
        operations: Object.freeze([
          Object.freeze({
            operation: "upsert",
            familyId: "approval-governance",
            settingKey: "runSubmissionApprovalMode",
          }),
        ]),
      }),
    );

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-request");
  });

  it("maps forbidden write outcomes to forbidden envelopes", async () => {
    const api = new DeploymentPolicyWriteBackendApi({
      updateDeploymentPolicyStateUseCase: {
        execute: async () => Object.freeze({
          ok: false as const,
          error: Object.freeze({
            code: "deployment-policy-update-forbidden",
            message: "Actor is not authorized.",
          }),
        }),
      } as never,
    });

    const response = await api.updateActiveProfile(
      Object.freeze({
        actorUserIdentityId: "user:member",
        workspaceId: "workspace-alpha",
      }),
      Object.freeze({
        profileId: "classroom",
      }),
    );

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("forbidden");
  });

  it("ignores actorUserIdentityId in override provenance from request payload", async () => {
    let capturedInput: unknown;
    const api = new DeploymentPolicyWriteBackendApi({
      updateDeploymentPolicyStateUseCase: {
        execute: async (input: unknown) => {
          capturedInput = input;
          return Object.freeze({
            ok: true as const,
            value: Object.freeze({
              scope: Object.freeze({
                kind: "deployment-policy-scope",
                scopeId: "workspace-alpha",
              }),
              dryRun: false,
              validation: Object.freeze({
                valid: true,
                issues: Object.freeze([]),
                evaluatedAt: "2026-04-08T00:00:00.000Z",
              }),
              overrideMutations: Object.freeze([]),
              snapshot: Object.freeze({
                contractVersion: "deployment-policy-administration/v1",
                profileId: "home",
                evaluatedAt: "2026-04-08T00:00:00.000Z",
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
            }),
          });
        },
      } as never,
    });

    await api.applyOverrideOperations(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: "workspace-alpha",
      }),
      Object.freeze({
        profileId: "home",
        operations: Object.freeze([
          Object.freeze({
            operation: "upsert",
            familyId: "sharing-governance",
            settingKey: "workspaceDefaultVisibility",
            value: "workspace-members",
            valueType: "string",
            provenance: Object.freeze({
              ticketReference: "CHG-2202",
              reason: "Story 20.2.5",
              updatedAt: "2026-04-08T00:01:00.000Z",
            }),
          }),
        ]),
      }),
    );

    const payload = capturedInput as {
      operations: ReadonlyArray<{
        kind: string;
        command?: {
          operations: ReadonlyArray<{
            provenance?: Record<string, unknown>;
          }>;
        };
      }>;
    };
    const provenance = payload.operations[0]?.command?.operations[0]?.provenance;
    expect(provenance?.actorUserIdentityId).toBeUndefined();
  });
});
