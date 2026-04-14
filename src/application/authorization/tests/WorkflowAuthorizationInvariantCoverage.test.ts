import { describe, expect, it } from "bun:test";
import {
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  createRoleAssignment,
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

const WORKSPACE_ID = "workspace:workflow-alpha";
const OWNER_USER_ID = "user:workflow-owner";
const WORKFLOW_RESOURCE_TYPE = "workflow";
const WORKFLOW_RESOURCE_ID = "workflow:alpha:definition";

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

function buildWorkflowInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>> {
  const guestRoleAssignmentId = "role-assignment:workflow:guest:workspace-alpha";
  const guestRoleAssignment = createWorkspaceRoleAssignment({
    id: guestRoleAssignmentId,
    actorUserIdentityId: "user:workflow-guest",
    roleKey: "guest",
    workspaceId: WORKSPACE_ID,
  });

  const readListViaVisibility = Object.freeze({
    scenarioId: "authorization-workflow-read-visibility-allowed",
    title: "workflow read/list stays allowed by workspace visibility while create remains denied",
    family: InvariantFeatureFamilies.workflow,
    capability: "workflow.read",
    actor: Object.freeze({
      actorUserIdentityId: "user:workflow-guest",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["guest"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: Object.freeze({
      ...buildDefaultResourceInvariantInput({
        actor: Object.freeze({
          actorUserIdentityId: "user:workflow-guest",
          activeWorkspaceId: WORKSPACE_ID,
        }),
        roleAssignments: Object.freeze([guestRoleAssignment]),
        requiredPermissionKey: "workflow.read",
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: WORKFLOW_RESOURCE_TYPE,
        resourceId: WORKFLOW_RESOURCE_ID,
        workspaceId: WORKSPACE_ID,
        ownerUserIdentityId: OWNER_USER_ID,
        asOf: INVARIANT_EVALUATION_AS_OF,
      }),
      resource: Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: WORKFLOW_RESOURCE_TYPE,
        resourceId: WORKFLOW_RESOURCE_ID,
        ownerUserIdentityId: OWNER_USER_ID,
        ownershipScope: "workspace",
        workspaceId: WORKSPACE_ID,
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "visibility-workspace-member",
        sourceKind: "visibility-rule",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "workflow.read",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
          resourceId: WORKFLOW_RESOURCE_ID,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([guestRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "read-list-vs-create-write", "resource-instance"]),
  });

  const createDeniedWithSameVisibilityContext = Object.freeze({
    ...readListViaVisibility,
    scenarioId: "authorization-workflow-create-visibility-denied",
    title: "workflow create remains denied for workspace visibility-only context",
    capability: "workflow.create",
    input: Object.freeze({
      ...readListViaVisibility.input,
      requiredPermissionKey: "workflow.create",
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: "workflow.create",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
          resourceId: WORKFLOW_RESOURCE_ID,
        }),
        unmatchedRoleAssignmentIds: Object.freeze([guestRoleAssignmentId]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "read-list-vs-create-write", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const runInitiationAllowed = createWorkspaceRoleAssignment({
    id: "role-assignment:workflow:initiate:member",
    actorUserIdentityId: "user:workflow-member",
    roleKey: "member",
    workspaceId: WORKSPACE_ID,
  });

  const initiateRunCapabilityAllowed = Object.freeze({
    scenarioId: "authorization-workflow-initiate-capability-allowed",
    title: "workflow initiation uses capability target semantics and allows member role",
    family: InvariantFeatureFamilies.workflow,
    capability: "workflow.run",
    actor: Object.freeze({
      actorUserIdentityId: "user:workflow-member",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildCapabilityTarget({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      permissionKey: "workflow.run",
      workspaceId: WORKSPACE_ID,
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:workflow-member",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([runInitiationAllowed]),
      requiredPermissionKey: "workflow.run",
      workspaceId: WORKSPACE_ID,
      capabilityResourceType: WORKFLOW_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "workflow.run",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:workflow:initiate:member"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "initiate", "capability-target"]),
  });

  const runInitiationDenied = createWorkspaceRoleAssignment({
    id: "role-assignment:workflow:initiate:viewer",
    actorUserIdentityId: "user:workflow-viewer",
    roleKey: "viewer",
    workspaceId: WORKSPACE_ID,
  });

  const initiateRunCapabilityDenied = Object.freeze({
    ...initiateRunCapabilityAllowed,
    scenarioId: "authorization-workflow-initiate-capability-denied",
    title: "workflow initiation denies viewer role when run capability is missing",
    actor: Object.freeze({
      actorUserIdentityId: "user:workflow-viewer",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["viewer"]),
    }),
    input: buildDefaultCapabilityInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:workflow-viewer",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([runInitiationDenied]),
      requiredPermissionKey: "workflow.run",
      workspaceId: WORKSPACE_ID,
      capabilityResourceType: WORKFLOW_RESOURCE_TYPE,
      asOf: INVARIANT_EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "no-effective-permission",
        denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "workflow.run",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
        }),
        unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:workflow:initiate:viewer"]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "initiate", "capability-target"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  const cancelRoleAssignment = createWorkspaceRoleAssignment({
    id: "role-assignment:workflow:cancel:member",
    actorUserIdentityId: "user:workflow-mutate-member",
    roleKey: "member",
    workspaceId: WORKSPACE_ID,
  });

  const cancelWorkflowMutationAllowed = Object.freeze({
    scenarioId: "authorization-workflow-cancel-resource-allowed",
    title: "workflow cancel mutation remains resource-instance scoped and allowed for member",
    family: InvariantFeatureFamilies.workflow,
    capability: "workflow.cancel",
    actor: Object.freeze({
      actorUserIdentityId: "user:workflow-mutate-member",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["member"]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: buildResourceTarget({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:workflow-mutate-member",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([cancelRoleAssignment]),
      requiredPermissionKey: "workflow.cancel",
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
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
        requiredPermissionKey: "workflow.cancel",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
          resourceId: WORKFLOW_RESOURCE_ID,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:workflow:cancel:member"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "mutate", "resource-instance"]),
  });

  const cancelScopeMismatchRoleAssignment = createWorkspaceRoleAssignment({
    id: "role-assignment:workflow:cancel:mismatch",
    actorUserIdentityId: "user:workflow-mutate-mismatch",
    roleKey: "member",
    workspaceId: "workspace:workflow-beta",
  });

  const cancelWorkflowMutationDeniedByScopeMismatch = Object.freeze({
    ...cancelWorkflowMutationAllowed,
    scenarioId: "authorization-workflow-cancel-resource-scope-mismatch-denied",
    title: "workflow cancel mutation denies mismatched workspace scope even with member role",
    actor: Object.freeze({
      actorUserIdentityId: "user:workflow-mutate-mismatch",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze(["member"]),
    }),
    input: buildDefaultResourceInvariantInput({
      actor: Object.freeze({
        actorUserIdentityId: "user:workflow-mutate-mismatch",
        activeWorkspaceId: WORKSPACE_ID,
      }),
      roleAssignments: Object.freeze([cancelScopeMismatchRoleAssignment]),
      requiredPermissionKey: "workflow.cancel",
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: WORKFLOW_RESOURCE_TYPE,
      resourceId: WORKFLOW_RESOURCE_ID,
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
        requiredPermissionKey: "workflow.cancel",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: WORKFLOW_RESOURCE_TYPE,
          resourceId: WORKFLOW_RESOURCE_ID,
        }),
        unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:workflow:cancel:mismatch"]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "workflow", "mutate", "scope-mismatch", "resource-instance"]),
  } satisfies InvariantScenarioDefinition<AuthorizationInvariantCoverageInput>);

  return Object.freeze([
    readListViaVisibility,
    createDeniedWithSameVisibilityContext,
    initiateRunCapabilityAllowed,
    initiateRunCapabilityDenied,
    cancelWorkflowMutationAllowed,
    cancelWorkflowMutationDeniedByScopeMismatch,
  ]);
}

describe("Workflow authorization invariant coverage", () => {
  it("covers read/create, initiate capability, and mutate scope distinctions via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(
      new AuthorizationPolicyInvariantAdapter(InvariantFeatureFamilies.workflow),
    );
    const scenarios = buildWorkflowInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-workflow-read-visibility-allowed",
      "authorization-workflow-create-visibility-denied",
      "authorization-workflow-initiate-capability-allowed",
      "authorization-workflow-initiate-capability-denied",
      "authorization-workflow-cancel-resource-allowed",
      "authorization-workflow-cancel-resource-scope-mismatch-denied",
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

  it("keeps capability-target and resource-instance semantics explicit for workflow slices", async () => {
    const scenarioKinds = new Set(
      buildWorkflowInvariantScenarios().map((scenario) => scenario.target.targetKind),
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
  });
});
