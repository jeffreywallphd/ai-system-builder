import { describe, expect, it } from "bun:test";
import {
  InvariantTargetKinds,
  assertAuthorizationDecisionAllowed,
  assertAuthorizationDecisionDenied,
  assertInvariantExecution,
  type InvariantExecutionResult,
  type InvariantScenarioDefinition,
} from "../index";

function buildBaseScenario(
  overrides?: Partial<InvariantScenarioDefinition>,
): InvariantScenarioDefinition {
  return Object.freeze({
    scenarioId: "authorization-outcome-assertion",
    title: "authorization invariant assertions",
    family: "asset",
    capability: "asset.read",
    actor: Object.freeze({
      actorUserIdentityId: "user-actor",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspace: Object.freeze({
      workspaceId: "workspace-alpha",
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.resource,
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:1",
      targetWorkspaceId: "workspace-alpha",
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    }),
    expectation: Object.freeze({
      outcome: "allow",
    }),
    ...overrides,
  });
}

function buildExecution(
  scenario: InvariantScenarioDefinition,
  observed: InvariantExecutionResult["observed"],
): InvariantExecutionResult {
  return Object.freeze({
    scenario,
    observed,
    evaluatedAt: "2026-04-13T12:00:00.000Z",
  });
}

describe("Authorization outcome assertions", () => {
  it("validates canonical allow decision details including source, scope, and provenance", () => {
    const scenario = buildBaseScenario({
      expectation: Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          reasonCode: "matched-role-grant",
          sourceKind: "role-grant",
          targetKind: InvariantTargetKinds.resource,
          requiredPermissionKey: "asset.read",
          scope: Object.freeze({
            isApplicable: true,
            scopeKind: "workspace",
            workspaceId: "workspace-alpha",
          }),
          matchedRoleAssignmentIds: Object.freeze(["role-member-1"]),
          unmatchedRoleAssignmentIds: Object.freeze(["role-viewer-1"]),
          provenance: Object.freeze({
            decisionService: "authorization-policy-decision-evaluator",
          }),
        }),
      }),
    });

    const execution = buildExecution(
      scenario,
      Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          reasonCode: "matched-role-grant",
          sourceKind: "role-grant",
          targetKind: InvariantTargetKinds.resource,
          requiredPermissionKey: "asset.read",
          scope: Object.freeze({
            isApplicable: true,
            scopeKind: "workspace",
            workspaceId: "workspace-alpha",
          }),
          matchedRoleAssignmentIds: Object.freeze(["role-member-1", "role-owner-1"]),
          matchedPermissionGrantIds: Object.freeze([]),
          matchedSharingGrantIds: Object.freeze([]),
          provenance: Object.freeze({
            decisionService: "authorization-policy-decision-evaluator",
          }),
        }),
      }),
    );

    expect(() => assertAuthorizationDecisionAllowed(execution)).not.toThrow();
    expect(() => assertInvariantExecution(execution)).not.toThrow();
  });

  it("validates canonical deny decision details including unmatched grants", () => {
    const scenario = buildBaseScenario({
      expectation: Object.freeze({
        outcome: "deny",
        decision: Object.freeze({
          reasonCode: "no-effective-permission",
          denialReason: "insufficient-permissions",
          sourceKind: "none",
          requiredPermissionKey: "asset.update",
          unmatchedPermissionGrantIds: Object.freeze(["grant-allow-1"]),
        }),
      }),
    });

    const execution = buildExecution(
      scenario,
      Object.freeze({
        outcome: "deny",
        decision: Object.freeze({
          reasonCode: "no-effective-permission",
          denialReason: "insufficient-permissions",
          sourceKind: "none",
          requiredPermissionKey: "asset.update",
          matchedRoleAssignmentIds: Object.freeze([]),
          matchedPermissionGrantIds: Object.freeze([]),
          matchedSharingGrantIds: Object.freeze([]),
        }),
      }),
    );

    expect(() => assertAuthorizationDecisionDenied(execution)).not.toThrow();
    expect(() => assertInvariantExecution(execution)).not.toThrow();
  });

  it("falls back to scenario target kind for capability-vs-resource semantics when diagnostics are absent", () => {
    const scenario = buildBaseScenario({
      target: Object.freeze({
        targetKind: InvariantTargetKinds.capability,
        resourceFamily: "capability-target",
        resourceType: "capability-target",
        resourceId: "capability:asset.create",
        targetWorkspaceId: "workspace-alpha",
      }),
      expectation: Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          targetKind: InvariantTargetKinds.capability,
        }),
      }),
    });

    const execution = buildExecution(
      scenario,
      Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          reasonCode: "matched-role-grant",
        }),
      }),
    );

    expect(() => assertInvariantExecution(execution)).not.toThrow();
  });

  it("reports informative failures when source kind drifts", () => {
    const scenario = buildBaseScenario({
      scenarioId: "source-kind-drift",
      expectation: Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          sourceKind: "sharing-grant",
        }),
      }),
    });
    const execution = buildExecution(
      scenario,
      Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          sourceKind: "role-grant",
        }),
      }),
    );

    expect(() => assertInvariantExecution(execution)).toThrow(/source-kind-drift/);
    expect(() => assertInvariantExecution(execution)).toThrow(/decision\.sourceKind/);
    expect(() => assertInvariantExecution(execution)).toThrow(/Observed decision/);
  });

  it("reports informative failures for workspace scope mismatches", () => {
    const scenario = buildBaseScenario({
      scenarioId: "scope-workspace-mismatch",
      expectation: Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          scope: Object.freeze({
            workspaceId: "workspace-alpha",
          }),
        }),
      }),
    });
    const execution = buildExecution(
      scenario,
      Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          scope: Object.freeze({
            workspaceId: "workspace-beta",
          }),
        }),
      }),
    );

    expect(() => assertInvariantExecution(execution)).toThrow(/scope-workspace-mismatch/);
    expect(() => assertInvariantExecution(execution)).toThrow(/decision\.scope\.workspaceId/);
  });
});
