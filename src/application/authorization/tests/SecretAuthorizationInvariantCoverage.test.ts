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

const WORKSPACE_ID = "workspace:secret-alpha";
const OWNER_USER_ID = "user:secret-owner";
const SECRET_RESOURCE_TYPE = "secret-metadata";
const SECRET_RESOURCE_ID = "secret:metadata:alpha";

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

function buildSecretInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>> {
  const aligned = buildAlignedInvariantWorkspaceRelationshipFixture({
    actor: Object.freeze({
      actorUserIdentityId: "user:secret-viewer",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: SECRET_RESOURCE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const readRoleAssignmentId = "role-assignment:secret:read:viewer";
  const readRoleAssignment = createWorkspaceRoleAssignment({
    id: readRoleAssignmentId,
    actorUserIdentityId: "user:secret-viewer",
    roleKey: "viewer",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const readSecretResourceAllowed = Object.freeze({
    scenarioId: "authorization-secret-read-resource-allowed",
    title: "secret metadata read allows viewer role on aligned workspace resource",
    family: InvariantFeatureFamilies.secret,
    capability: "secret-metadata.read",
    actor: Object.freeze({
      actorUserIdentityId: "user:secret-viewer",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      roleKeys: Object.freeze(["viewer"]),
    }),
    workspace: aligned.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:secret-viewer",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([readRoleAssignment]),
      requiredPermissionKey: "secret-metadata.read",
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
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
        requiredPermissionKey: "secret-metadata.read",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: aligned.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.secretMetadata,
          resourceType: SECRET_RESOURCE_TYPE,
          resourceId: aligned.resource.resourceId,
        }),
        matchedRoleAssignmentIds: Object.freeze([readRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "secret", "metadata-read", "resource-instance"]),
  });

  const updateRoleAssignmentId = "role-assignment:secret:update:member";
  const updateRoleAssignment = createWorkspaceRoleAssignment({
    id: updateRoleAssignmentId,
    actorUserIdentityId: "user:secret-member",
    roleKey: "member",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const updateSecretResourceDenied = Object.freeze({
    ...readSecretResourceAllowed,
    scenarioId: "authorization-secret-update-resource-denied",
    title: "secret metadata update denies member role to preserve stricter sensitive-surface posture",
    capability: "secret-metadata.update",
    actor: Object.freeze({
      actorUserIdentityId: "user:secret-member",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      roleKeys: Object.freeze(["member"]),
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:secret-member",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([updateRoleAssignment]),
      requiredPermissionKey: "secret-metadata.update",
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: aligned.resource.resourceId,
      workspaceId: aligned.resource.workspaceId!,
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
        requiredPermissionKey: "secret-metadata.update",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: aligned.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.secretMetadata,
          resourceType: SECRET_RESOURCE_TYPE,
          resourceId: aligned.resource.resourceId,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([updateRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "secret", "metadata-update", "sensitive-surface", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const actorResourceMismatch = buildInvariantWorkspaceRelationshipFixture({
    mode: InvariantWorkspaceRelationshipModes.actorVsResourceMismatch,
    actor: Object.freeze({
      actorUserIdentityId: "user:secret-admin-mismatch",
    }),
    activeWorkspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: "secret:metadata:mismatch",
      ownerUserIdentityId: OWNER_USER_ID,
    }),
  });

  const mismatchRoleAssignmentId = "role-assignment:secret:manage:admin:mismatch";
  const mismatchRoleAssignment = createWorkspaceRoleAssignment({
    id: mismatchRoleAssignmentId,
    actorUserIdentityId: "user:secret-admin-mismatch",
    roleKey: "admin",
    workspaceId: actorResourceMismatch.actor.activeWorkspaceId!,
  });

  const manageSecretResourceDeniedByWorkspaceMismatch = Object.freeze({
    ...readSecretResourceAllowed,
    scenarioId: "authorization-secret-manage-resource-workspace-mismatch-denied",
    title: "secret metadata manage denies when admin role is scoped to a different workspace than the secret resource",
    capability: "secret-metadata.manage",
    actor: Object.freeze({
      ...actorResourceMismatch.actor,
      roleKeys: Object.freeze(["admin"]),
    }),
    workspace: actorResourceMismatch.resourceWorkspace,
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      resourceId: actorResourceMismatch.resource.resourceId,
      workspaceId: actorResourceMismatch.resource.workspaceId!,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:secret-admin-mismatch",
        activeWorkspaceId: actorResourceMismatch.actor.activeWorkspaceId,
      }),
      roleAssignments: Object.freeze([mismatchRoleAssignment]),
      requiredPermissionKey: "secret-metadata.manage",
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
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
        requiredPermissionKey: "secret-metadata.manage",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: actorResourceMismatch.resource.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.secretMetadata,
          resourceType: SECRET_RESOURCE_TYPE,
          resourceId: actorResourceMismatch.resource.resourceId,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([mismatchRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "secret", "metadata-manage", "workspace-mismatch", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const createCapabilityRoleAssignmentId = "role-assignment:secret:create:admin";
  const createCapabilityRoleAssignment = createWorkspaceRoleAssignment({
    id: createCapabilityRoleAssignmentId,
    actorUserIdentityId: "user:secret-admin",
    roleKey: "admin",
    workspaceId: aligned.activeWorkspace.workspaceId,
  });

  const createSecretCapabilityAllowed = Object.freeze({
    scenarioId: "authorization-secret-create-capability-allowed",
    title: "secret metadata create remains workspace capability scoped and allows admin role",
    family: InvariantFeatureFamilies.secret,
    capability: "secret-metadata.create",
    actor: Object.freeze({
      actorUserIdentityId: "user:secret-admin",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      roleKeys: Object.freeze(["admin"]),
    }),
    workspace: aligned.activeWorkspace,
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      permissionKey: "secret-metadata.create",
      workspaceId: aligned.activeWorkspace.workspaceId,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:secret-admin",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([createCapabilityRoleAssignment]),
      requiredPermissionKey: "secret-metadata.create",
      workspaceId: aligned.activeWorkspace.workspaceId,
      capabilityResourceType: SECRET_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "secret-metadata.create",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: aligned.activeWorkspace.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.secretMetadata,
          resourceType: SECRET_RESOURCE_TYPE,
        }),
        matchedRoleAssignmentIds: Object.freeze([createCapabilityRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "secret", "metadata-create", "capability-target"]),
  });

  const manageSecretCapabilityDenyByDefault = Object.freeze({
    ...createSecretCapabilityAllowed,
    scenarioId: "authorization-secret-manage-capability-deny-by-default",
    title: "secret metadata manage denies by default when no role assignments apply",
    capability: "secret-metadata.manage",
    actor: Object.freeze({
      actorServiceId: "service:secret-admin-api",
      activeWorkspaceId: aligned.activeWorkspace.workspaceId,
    }),
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.secretMetadata,
      resourceType: SECRET_RESOURCE_TYPE,
      permissionKey: "secret-metadata.manage",
      workspaceId: aligned.activeWorkspace.workspaceId,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorServiceId: "service:secret-admin-api",
        activeWorkspaceId: aligned.activeWorkspace.workspaceId,
      }),
      roleAssignments: Object.freeze([]),
      requiredPermissionKey: "secret-metadata.manage",
      workspaceId: aligned.activeWorkspace.workspaceId,
      capabilityResourceType: SECRET_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "secret-metadata.manage",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: aligned.activeWorkspace.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.secretMetadata,
          resourceType: SECRET_RESOURCE_TYPE,
        }),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "secret", "metadata-manage", "deny-by-default", "capability-target"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  return Object.freeze([
    readSecretResourceAllowed,
    updateSecretResourceDenied,
    manageSecretResourceDeniedByWorkspaceMismatch,
    createSecretCapabilityAllowed,
    manageSecretCapabilityDenyByDefault,
  ]);
}

describe("Secret metadata authorization invariant coverage", () => {
  it("covers sensitive secret metadata capability/resource slices via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(
      new AuthorizationPolicyInvariantAdapter(InvariantFeatureFamilies.secret),
    );
    const scenarios = buildSecretInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-secret-read-resource-allowed",
      "authorization-secret-update-resource-denied",
      "authorization-secret-manage-resource-workspace-mismatch-denied",
      "authorization-secret-create-capability-allowed",
      "authorization-secret-manage-capability-deny-by-default",
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

  it("keeps capability-target and resource-instance semantics explicit for secret metadata surfaces", () => {
    const scenarios = buildSecretInvariantScenarios();
    const scenarioKinds = new Set(
      scenarios.map((scenario) => scenario.target.targetKind),
    );
    const denyByDefaultScenario = scenarios.find(
      (scenario) => scenario.scenarioId === "authorization-secret-manage-capability-deny-by-default",
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
    expect(denyByDefaultScenario).toBeDefined();
    expect(denyByDefaultScenario?.actor.actorServiceId).toBe("service:secret-admin-api");
  });
});
