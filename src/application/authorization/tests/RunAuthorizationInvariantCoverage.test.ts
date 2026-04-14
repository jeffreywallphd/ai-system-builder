import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  RoleAssignmentScopes,
  createPermissionGrant,
  createRoleAssignment,
  type PermissionGrant,
  type RoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { AuthorizationPolicyDecisionDenialReasons } from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  InvariantTargetKinds,
  executeAndAssertInvariantScenario,
  type InvariantScenarioDefinition,
} from "../../../testing/invariants";
import {
  AuthorizationPolicyInvariantAdapter,
  INVARIANT_EVALUATION_AS_OF,
  INVARIANT_ROLE_ASSIGNED_AT,
  buildCapabilityTarget,
  buildDefaultCapabilityInvariantInput,
  buildDefaultResourceInvariantInput,
  buildResourceTarget,
  type AuthorizationInvariantCoverageInput,
} from "./AuthorizationInvariantCoverageTestSupport";

const WORKSPACE_ID = "workspace:run-alpha";
const OWNER_USER_ID = "user:run-owner";
const RUN_RESOURCE_TYPE = "run";
const RUN_RESOURCE_ID = "run:alpha:1";

function createWorkspaceRoleAssignment(input: {
  readonly id: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: string;
  readonly workspaceId: string;
}): RoleAssignment {
  return createRoleAssignment({
    id: input.id,
    actorUserIdentityId: input.actorUserIdentityId,
    roleKey: input.roleKey,
    scope: RoleAssignmentScopes.workspace,
    workspaceId: input.workspaceId,
    assignedByUserIdentityId: OWNER_USER_ID,
    assignedAt: INVARIANT_ROLE_ASSIGNED_AT,
  });
}

function buildRunInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>> {
  const listRoleAssignmentViewer = createWorkspaceRoleAssignment({
    id: "role-assignment:run:list:viewer",
    actorUserIdentityId: "user:run-viewer",
    roleKey: "viewer",
    workspaceId: WORKSPACE_ID,
  });

  const listWorkspaceCapabilityAllowed = Object.freeze({
    scenarioId: "authorization-run-list-capability-allowed",
    title: "run list remains workspace capability scoped and allows viewer role",
    family: InvariantFeatureFamilies.run,
    capability: "run.list",
    actor: Object.freeze({
      actorUserIdentityId: "user:run-viewer",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["viewer"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      permissionKey: "run.list",
      workspaceId: WORKSPACE_ID,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:run-viewer",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([listRoleAssignmentViewer]),
      requiredPermissionKey: "run.list",
      workspaceId: WORKSPACE_ID,
      capabilityResourceType: RUN_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "run.list",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:run:list:viewer"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "list-read", "capability-target"]),
  });

  const listScopeMismatchRoleAssignment = createWorkspaceRoleAssignment({
    id: "role-assignment:run:list:mismatch",
    actorUserIdentityId: "user:run-list-mismatch",
    roleKey: "viewer",
    workspaceId: "workspace:run-beta",
  });

  const listWorkspaceCapabilityDeniedByScopeMismatch = Object.freeze({
    ...listWorkspaceCapabilityAllowed,
    scenarioId: "authorization-run-list-capability-scope-mismatch-denied",
    title: "run list capability denies when role assignment scope does not match workspace",
    actor: Object.freeze({
      actorUserIdentityId: "user:run-list-mismatch",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["viewer"]),
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:run-list-mismatch",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([listScopeMismatchRoleAssignment]),
      requiredPermissionKey: "run.list",
      workspaceId: WORKSPACE_ID,
      capabilityResourceType: RUN_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "run.list",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
        }),
        unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:run:list:mismatch"]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "list-read", "scope-mismatch", "capability-target"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const runReadViewerRole = createWorkspaceRoleAssignment({
    id: "role-assignment:run:read:viewer",
    actorUserIdentityId: "user:run-read-viewer",
    roleKey: "viewer",
    workspaceId: WORKSPACE_ID,
  });

  const readResourceAllowed = Object.freeze({
    scenarioId: "authorization-run-read-resource-allowed",
    title: "run read stays resource-instance scoped and allows viewer role",
    family: InvariantFeatureFamilies.run,
    capability: "run.read",
    actor: Object.freeze({
      actorUserIdentityId: "user:run-read-viewer",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["viewer"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:run-read-viewer",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([runReadViewerRole]),
      requiredPermissionKey: "run.read",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "run.read",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
          resourceId: RUN_RESOURCE_ID,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:run:read:viewer"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "list-read", "resource-instance"]),
  });

  const readResourceDenyByDefault = Object.freeze({
    ...readResourceAllowed,
    scenarioId: "authorization-run-read-resource-no-applicable-path-denied",
    title: "run read denies by default when no applicable role or grant exists",
    actor: Object.freeze({
      actorServiceId: "service:run-query",
      activeWorkspaceId: WORKSPACE_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorServiceId: "service:run-query",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([]),
      requiredPermissionKey: "run.read",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "run.read",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
          resourceId: RUN_RESOURCE_ID,
        }),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "list-read", "deny-by-default", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const runCancelMemberRole = createWorkspaceRoleAssignment({
    id: "role-assignment:run:cancel:member",
    actorUserIdentityId: "user:run-cancel-member",
    roleKey: "member",
    workspaceId: WORKSPACE_ID,
  });

  const cancelResourceAllowed = Object.freeze({
    scenarioId: "authorization-run-cancel-resource-allowed",
    title: "run cancel mutation allows member role on concrete run instance",
    family: InvariantFeatureFamilies.run,
    capability: "run.cancel",
    actor: Object.freeze({
      actorUserIdentityId: "user:run-cancel-member",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:run-cancel-member",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([runCancelMemberRole]),
      requiredPermissionKey: "run.cancel",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "run.cancel",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
          resourceId: RUN_RESOURCE_ID,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:run:cancel:member"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "mutate", "resource-instance"]),
  });

  const denyPermissionGrantId = "permission-grant:run:cancel:explicit-deny";
  const cancelDeniedPermissionGrant: PermissionGrant = createPermissionGrant({
    id: denyPermissionGrantId,
    permissionKey: "run.cancel",
    effect: PermissionEffects.deny,
    scope: PermissionGrantScopes.workspace,
    workspaceId: WORKSPACE_ID,
    grantedByUserIdentityId: OWNER_USER_ID,
    grantedAt: INVARIANT_ROLE_ASSIGNED_AT,
  });

  const cancelResourceDeniedByExplicitGrant = Object.freeze({
    ...cancelResourceAllowed,
    scenarioId: "authorization-run-cancel-resource-explicit-deny",
    title: "run cancel mutation preserves explicit deny precedence over role grants",
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:run-cancel-member",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([runCancelMemberRole]),
      permissionGrants: Object.freeze([cancelDeniedPermissionGrant]),
      requiredPermissionKey: "run.cancel",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: RUN_RESOURCE_TYPE,
      resourceId: RUN_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "explicit-deny-permission-grant",
        denialReason: AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant,
        sourceKind: "explicit-deny",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "run.cancel",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: RUN_RESOURCE_TYPE,
          resourceId: RUN_RESOURCE_ID,
        }),
        matchedPermissionGrantIds: Object.freeze([denyPermissionGrantId]),
        unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:run:cancel:member"]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "run", "mutate", "explicit-deny", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  return Object.freeze([
    listWorkspaceCapabilityAllowed,
    listWorkspaceCapabilityDeniedByScopeMismatch,
    readResourceAllowed,
    readResourceDenyByDefault,
    cancelResourceAllowed,
    cancelResourceDeniedByExplicitGrant,
  ]);
}

describe("Run authorization invariant coverage", () => {
  it("covers list/read and cancel mutation slices via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(
      new AuthorizationPolicyInvariantAdapter(InvariantFeatureFamilies.run),
    );
    const scenarios = buildRunInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-run-list-capability-allowed",
      "authorization-run-list-capability-scope-mismatch-denied",
      "authorization-run-read-resource-allowed",
      "authorization-run-read-resource-no-applicable-path-denied",
      "authorization-run-cancel-resource-allowed",
      "authorization-run-cancel-resource-explicit-deny",
    ]));

    for (const scenario of scenarios) {
      const execution = await executeAndAssertInvariantScenario(registry, {
        scenario,
        now: () => new Date(INVARIANT_EVALUATION_AS_OF),
      });
      expect(execution.observed.decision?.reasonCode).toBe(scenario.expectation.decision?.reasonCode);
      expect(execution.observed.decision?.sourceKind).toBe(scenario.expectation.decision?.sourceKind);
    }
  });

  it("keeps capability-target and resource-instance semantics explicit for run slices", () => {
    const scenarioKinds = new Set(
      buildRunInvariantScenarios().map((scenario) => scenario.target.targetKind),
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
  });
});
