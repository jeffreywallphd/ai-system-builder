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

const WORKSPACE_ID = "workspace:storage-alpha";
const OWNER_USER_ID = "user:storage-owner";
const STORAGE_RESOURCE_TYPE = "storage-instance";
const STORAGE_RESOURCE_ID = "storage:instance:alpha";

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

function buildStorageInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>> {
  const aligned = buildAlignedInvariantWorkspaceRelationshipFixture({
    actor: Object.freeze({
      actorUserIdentityId: "user:storage-member",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: STORAGE_RESOURCE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const mountRoleAssignmentId = "role-assignment:storage:mount:member";
  const mountRoleAssignment = createWorkspaceRoleAssignment({
    id: mountRoleAssignmentId,
    actorUserIdentityId: "user:storage-member",
    roleKey: "member",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const mountStorageResourceAllowed = Object.freeze({
    scenarioId: "authorization-storage-mount-resource-allowed",
    title: "storage mount allows member role when storage instance workspace aligns with actor workspace",
    family: InvariantFeatureFamilies.storage,
    capability: "storage-instance.mount",
    actor: Object.freeze({
      ...aligned.actor,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: aligned.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:storage-member",
        activeWorkspaceId: aligned.actor.activeWorkspaceId,
      }),
      roleAssignments: Object.freeze([mountRoleAssignment]),
      requiredPermissionKey: "storage-instance.mount",
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
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
        requiredPermissionKey: "storage-instance.mount",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: aligned.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.storageInstance,
          resourceType: STORAGE_RESOURCE_TYPE,
          resourceId: aligned.resource.resourceId,
        }),
        matchedRoleAssignmentIds: Object.freeze([mountRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "storage", "mount", "workspace-aligned", "resource-instance"]),
  });

  const actorResourceMismatch = buildInvariantWorkspaceRelationshipFixture({
    mode: InvariantWorkspaceRelationshipModes.actorVsResourceMismatch,
    actor: Object.freeze({
      actorUserIdentityId: "user:storage-mount-mismatch",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: "storage:instance:mismatch",
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const mismatchRoleAssignmentId = "role-assignment:storage:mount:member:mismatch";
  const mismatchRoleAssignment = createWorkspaceRoleAssignment({
    id: mismatchRoleAssignmentId,
    actorUserIdentityId: "user:storage-mount-mismatch",
    roleKey: "member",
    workspaceId: actorResourceMismatch.actor.activeWorkspaceId!,
  });

  const mountStorageResourceDeniedByWorkspaceMismatch = Object.freeze({
    ...mountStorageResourceAllowed,
    scenarioId: "authorization-storage-mount-resource-workspace-mismatch-denied",
    title: "storage mount denies when actor workspace assignment does not apply to storage resource workspace",
    actor: Object.freeze({
      ...actorResourceMismatch.actor,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: actorResourceMismatch.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:storage-mount-mismatch",
        activeWorkspaceId: actorResourceMismatch.actor.activeWorkspaceId,
      }),
      roleAssignments: Object.freeze([mismatchRoleAssignment]),
      requiredPermissionKey: "storage-instance.mount",
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
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
        requiredPermissionKey: "storage-instance.mount",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: actorResourceMismatch.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.storageInstance,
          resourceType: STORAGE_RESOURCE_TYPE,
          resourceId: actorResourceMismatch.resource.resourceId,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([mismatchRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "storage", "mount", "workspace-mismatch", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const createCapabilityRoleAssignmentId = "role-assignment:storage:create:member";
  const createCapabilityRoleAssignment = createWorkspaceRoleAssignment({
    id: createCapabilityRoleAssignmentId,
    actorUserIdentityId: "user:storage-member-create",
    roleKey: "member",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const createStorageCapabilityDenied = Object.freeze({
    scenarioId: "authorization-storage-create-capability-denied",
    title: "storage create capability remains workspace scoped and denies member role without create grant",
    family: InvariantFeatureFamilies.storage,
    capability: "storage-instance.create",
    actor: Object.freeze({
      actorUserIdentityId: "user:storage-member-create",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: aligned.activeWorkspace,
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.storageInstance,
      resourceType: STORAGE_RESOURCE_TYPE,
      permissionKey: "storage-instance.create",
      workspaceId: aligned.activeWorkspace.workspaceId,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:storage-member-create",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([createCapabilityRoleAssignment]),
      requiredPermissionKey: "storage-instance.create",
      workspaceId: aligned.activeWorkspace.workspaceId,
      capabilityResourceType: STORAGE_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "storage-instance.create",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: aligned.activeWorkspace.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.storageInstance,
          resourceType: STORAGE_RESOURCE_TYPE,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([createCapabilityRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "storage", "create", "capability-target"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  return Object.freeze([
    mountStorageResourceAllowed,
    mountStorageResourceDeniedByWorkspaceMismatch,
    createStorageCapabilityDenied,
  ]);
}

describe("Storage authorization invariant coverage", () => {
  it("covers storage mount/create slices via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(
      new AuthorizationPolicyInvariantAdapter(InvariantFeatureFamilies.storage),
    );
    const scenarios = buildStorageInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-storage-mount-resource-allowed",
      "authorization-storage-mount-resource-workspace-mismatch-denied",
      "authorization-storage-create-capability-denied",
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

  it("keeps capability/resource split and workspace mismatch semantics explicit for storage slices", () => {
    const scenarios = buildStorageInvariantScenarios();
    const scenarioKinds = new Set(
      scenarios.map((scenario) => scenario.target.targetKind),
    );
    const mismatchScenario = scenarios.find(
      (scenario) => scenario.scenarioId === "authorization-storage-mount-resource-workspace-mismatch-denied",
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
    expect(mismatchScenario).toBeDefined();
    expect(mismatchScenario!.actor.activeWorkspaceId).not.toBe(mismatchScenario!.target.workspaceId);
  });
});
