import { describe, expect, it } from "bun:test";
import {
  RoleAssignmentScopes,
  createRoleAssignment,
  type RoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { AuthorizationPolicyDecisionDenialReasons } from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  InvariantTargetKinds,
  InvariantWorkspaceRelationshipModes,
  buildAlignedInvariantWorkspaceRelationshipFixture,
  buildInvariantWorkspaceRelationshipFixture,
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

const WORKSPACE_ID = "workspace:system-alpha";
const OWNER_USER_ID = "user:system-owner";
const SYSTEM_RESOURCE_TYPE = "system";
const SYSTEM_RESOURCE_ID = "system:runtime:alpha";

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

function buildSystemInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>> {
  const aligned = buildAlignedInvariantWorkspaceRelationshipFixture({
    actor: Object.freeze({
      actorUserIdentityId: "user:system-admin",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: SYSTEM_RESOURCE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const manageRoleAssignmentId = "role-assignment:system:manage:admin";
  const manageRoleAssignment = createWorkspaceRoleAssignment({
    id: manageRoleAssignmentId,
    actorUserIdentityId: "user:system-admin",
    roleKey: "admin",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const manageResourceAllowed = Object.freeze({
    scenarioId: "authorization-system-manage-resource-allowed",
    title: "system manage mutation allows admin role when actor and system resource share workspace scope",
    family: InvariantFeatureFamilies.system,
    capability: "system.manage",
    actor: Object.freeze({
      ...aligned.actor,
      roleKeys: Object.freeze(["admin"]),
    }),
    workspace: aligned.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:system-admin",
        activeWorkspaceId: aligned.actor.activeWorkspaceId,
      }),
      roleAssignments: Object.freeze([manageRoleAssignment]),
      requiredPermissionKey: "system.manage",
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "system.manage",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: aligned.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.system,
          resourceType: SYSTEM_RESOURCE_TYPE,
          resourceId: aligned.resource.resourceId,
        }),
        matchedRoleAssignmentIds: Object.freeze([manageRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "system", "manage", "workspace-aligned", "resource-instance"]),
  });

  const actorResourceMismatch = buildInvariantWorkspaceRelationshipFixture({
    mode: InvariantWorkspaceRelationshipModes.actorVsResourceMismatch,
    actor: Object.freeze({
      actorUserIdentityId: "user:system-manage-mismatch",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: "system:runtime:mismatch",
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const mismatchedRoleAssignmentId = "role-assignment:system:manage:admin:mismatch";
  const mismatchedWorkspaceRole = createWorkspaceRoleAssignment({
    id: mismatchedRoleAssignmentId,
    actorUserIdentityId: "user:system-manage-mismatch",
    roleKey: "admin",
    workspaceId: actorResourceMismatch.actor.activeWorkspaceId!,
  });

  const manageResourceDeniedByWorkspaceMismatch = Object.freeze({
    ...manageResourceAllowed,
    scenarioId: "authorization-system-manage-resource-workspace-mismatch-denied",
    title: "system manage denies when actor workspace assignment does not apply to resource workspace",
    actor: Object.freeze({
      ...actorResourceMismatch.actor,
      roleKeys: Object.freeze(["admin"]),
    }),
    workspace: actorResourceMismatch.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:system-manage-mismatch",
        activeWorkspaceId: actorResourceMismatch.actor.activeWorkspaceId,
      }),
      roleAssignments: Object.freeze([mismatchedWorkspaceRole]),
      requiredPermissionKey: "system.manage",
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
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
        requiredPermissionKey: "system.manage",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: actorResourceMismatch.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.system,
          resourceType: SYSTEM_RESOURCE_TYPE,
          resourceId: actorResourceMismatch.resource.resourceId,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([mismatchedRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "system", "manage", "workspace-mismatch", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const executeCapabilityRoleAssignmentId = "role-assignment:system:execute:member";
  const executeCapabilityRoleAssignment = createWorkspaceRoleAssignment({
    id: executeCapabilityRoleAssignmentId,
    actorUserIdentityId: "user:system-member",
    roleKey: "member",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const executeCapabilityAllowed = Object.freeze({
    scenarioId: "authorization-system-execute-capability-allowed",
    title: "system execute capability remains workspace scoped and allows member role",
    family: InvariantFeatureFamilies.system,
    capability: "system.execute",
    actor: Object.freeze({
      actorUserIdentityId: "user:system-member",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: aligned.activeWorkspace,
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: SYSTEM_RESOURCE_TYPE,
      permissionKey: "system.execute",
      workspaceId: aligned.activeWorkspace.workspaceId,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:system-member",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([executeCapabilityRoleAssignment]),
      requiredPermissionKey: "system.execute",
      workspaceId: aligned.activeWorkspace.workspaceId,
      capabilityResourceType: SYSTEM_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "system.execute",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: aligned.activeWorkspace.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.system,
          resourceType: SYSTEM_RESOURCE_TYPE,
        }),
        matchedRoleAssignmentIds: Object.freeze([executeCapabilityRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "system", "execute", "capability-target"]),
  });

  return Object.freeze([
    manageResourceAllowed,
    manageResourceDeniedByWorkspaceMismatch,
    executeCapabilityAllowed,
  ]);
}

describe("System authorization invariant coverage", () => {
  it("covers system mutation and execute slices via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(
      new AuthorizationPolicyInvariantAdapter(InvariantFeatureFamilies.system),
    );
    const scenarios = buildSystemInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-system-manage-resource-allowed",
      "authorization-system-manage-resource-workspace-mismatch-denied",
      "authorization-system-execute-capability-allowed",
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

  it("keeps capability/resource split and workspace mismatch semantics explicit for system slices", () => {
    const scenarios = buildSystemInvariantScenarios();
    const scenarioKinds = new Set(
      scenarios.map((scenario) => scenario.target.targetKind),
    );
    const mismatchScenario = scenarios.find(
      (scenario) => scenario.scenarioId === "authorization-system-manage-resource-workspace-mismatch-denied",
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
    expect(mismatchScenario).toBeDefined();
    expect(mismatchScenario!.actor.activeWorkspaceId).not.toBe(mismatchScenario!.target.workspaceId);
  });
});
