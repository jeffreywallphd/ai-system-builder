import { describe, expect, it, mock } from "bun:test";
import { DeploymentPolicyAdministrationWriteService } from "../DeploymentPolicyAdministrationWriteService";

describe("DeploymentPolicyAdministrationWriteService", () => {
  it("submits active profile updates and parses canonical write responses", async () => {
    const service = new DeploymentPolicyAdministrationWriteService({
      client: {
        updateActiveProfile: mock(async () => Object.freeze({
          ok: true,
          data: createWriteResponseFixture("organization"),
        })),
        applyOverrideOperations: mock(async () => {
          throw new Error("not called");
        }),
      },
    });

    const result = await service.updateActiveProfile({
      context: Object.freeze({
        actorUserIdentityId: "admin-1",
        sessionToken: "token-1",
        workspaceId: "workspace-alpha",
      }),
      request: Object.freeze({
        profileId: "organization",
        reason: "Promote baseline",
      }),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.data.result.scope.scopeId).toBe("workspace-alpha");
    expect(result.data.result.snapshot.profileId).toBe("organization");
  });

  it("maps forbidden api failures with validation issues", async () => {
    const service = new DeploymentPolicyAdministrationWriteService({
      client: {
        updateActiveProfile: mock(async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "forbidden",
            message: "Actor is not authorized.",
            validationErrors: Object.freeze([
              Object.freeze({
                path: "command.operations[0].familyId",
                code: "unknown-family",
                message: "Policy family is unsupported.",
              }),
            ]),
          }),
        })),
        applyOverrideOperations: mock(async () => {
          throw new Error("not called");
        }),
      },
    });

    const result = await service.updateActiveProfile({
      context: Object.freeze({
        actorUserIdentityId: "admin-1",
        sessionToken: "token-1",
        workspaceId: "workspace-alpha",
      }),
      request: Object.freeze({
        profileId: "home",
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("forbidden");
    expect(result.error.message).toBe("Actor is not authorized.");
    expect(result.error.validationIssues[0]?.path).toBe("command.operations[0].familyId");
  });

  it("returns invalid-request when override request payload is malformed", async () => {
    const applyOverrideOperations = mock(async () => Object.freeze({
      ok: true,
      data: createWriteResponseFixture("home"),
    }));

    const service = new DeploymentPolicyAdministrationWriteService({
      client: {
        updateActiveProfile: mock(async () => {
          throw new Error("not called");
        }),
        applyOverrideOperations,
      },
    });

    const result = await service.applyOverrideOperations({
      context: Object.freeze({
        actorUserIdentityId: "admin-1",
        sessionToken: "token-1",
        workspaceId: "workspace-alpha",
      }),
      request: Object.freeze({
        profileId: "home",
        operations: Object.freeze([
          Object.freeze({
            operation: "remove",
            familyId: "sharing-posture",
            settingKey: "defaultWorkspaceVisibility",
            value: "workspace",
          }),
        ]),
      }),
    });

    expect(result.ok).toBeFalse();
    expect(applyOverrideOperations).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-request");
      expect(result.error.validationIssues.length).toBeGreaterThan(0);
    }
  });
});

function createWriteResponseFixture(profileId: "home" | "classroom" | "organization") {
  return Object.freeze({
    result: Object.freeze({
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
        profileId,
        evaluatedAt: "2026-04-08T00:00:00.000Z",
        evaluationLayer: "application",
        preset: Object.freeze({
          profileId,
          lineage: profileId === "home"
            ? Object.freeze(["home"])
            : profileId === "classroom"
              ? Object.freeze(["home", "classroom"])
              : Object.freeze(["home", "classroom", "organization"]),
          inheritedFrom: profileId === "home"
            ? Object.freeze([])
            : profileId === "classroom"
              ? Object.freeze(["home"])
              : Object.freeze(["home", "classroom"]),
          parentProfileId: profileId === "home" ? undefined : profileId === "classroom" ? "home" : "classroom",
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
}
