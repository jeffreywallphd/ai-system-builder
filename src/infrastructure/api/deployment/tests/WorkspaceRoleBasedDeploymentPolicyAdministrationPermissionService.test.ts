import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyAdministrationPermissionKeys,
  type DeploymentPolicyAdministrationPermissionKey,
} from "@application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import {
  createWorkspaceRoleAssignment,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import {
  DeploymentPolicyPersistenceScopeKinds,
  type DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  InvariantTargetKinds,
  executeAndAssertInvariantScenario,
  type InvariantDecisionOutcome,
  type InvariantEvaluationRequest,
  type InvariantFamilyAdapter,
  type InvariantObservedResult,
  type InvariantScenarioDefinition,
} from "../../../../testing/invariants";
import { WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService } from "../WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService";

const WORKSPACE_ID = "workspace-alpha";
const OWNER_USER_ID = "user:owner";
const EVALUATION_AS_OF = "2026-04-13T00:00:00.000Z";

interface DeploymentAdminInvariantInput {
  readonly actorUserIdentityId: string;
  readonly requiredPermission: DeploymentPolicyAdministrationPermissionKey;
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly roleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
  readonly asOf?: string;
}

class DeploymentPolicyAdministrationInvariantAdapter
implements InvariantFamilyAdapter<DeploymentAdminInvariantInput> {
  public readonly family = InvariantFeatureFamilies.adminDeployment;

  public async evaluate(
    request: InvariantEvaluationRequest<DeploymentAdminInvariantInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' must include deployment admin invariant input.`);
    }

    let candidateRoleAssignmentIds: ReadonlyArray<string> = Object.freeze([]);
    let matchedRoleAssignmentIds: ReadonlyArray<string> = Object.freeze([]);

    const service = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
      workspaceRoleAssignmentRepository: {
        findRoleAssignmentById: async () => undefined,
        countActiveRoleAssignments: async () => 0,
        saveRoleAssignment: async () => {
          throw new Error("Workspace role assignment persistence is not used in invariant tests.");
        },
        listRoleAssignments: async (query) => {
          const candidates = input.roleAssignments.filter((assignment) => {
            if (assignment.workspaceId !== query.workspaceId) {
              return false;
            }
            if (query.userIdentityId && assignment.userIdentityId !== query.userIdentityId) {
              return false;
            }
            if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(assignment.status)) {
              return false;
            }
            return true;
          });

          const matched = candidates.filter((assignment) => {
            if (query.roles && query.roles.length > 0 && !query.roles.includes(assignment.role)) {
              return false;
            }
            return true;
          });

          candidateRoleAssignmentIds = Object.freeze(candidates.map((assignment) => assignment.id));
          const limited = query.limit ? matched.slice(0, query.limit) : matched;
          matchedRoleAssignmentIds = Object.freeze(limited.map((assignment) => assignment.id));
          return Object.freeze(limited);
        },
      },
    });

    const decision = await service.evaluatePermission({
      actorUserIdentityId: input.actorUserIdentityId,
      requiredPermission: input.requiredPermission,
      scope: input.scope,
      asOf: input.asOf,
    });

    const outcome: InvariantDecisionOutcome = decision.allowed ? "allow" : "deny";
    const targetKind = request.scenario.target.targetKind ?? InvariantTargetKinds.capability;
    const scopeKind = targetKind === InvariantTargetKinds.capability ? "workspace-capability" : "workspace";
    const workspaceId = input.scope.scopeId.trim().toLowerCase();

    return Object.freeze({
      outcome,
      decision: Object.freeze({
        reasonCode: decision.allowed ? "matched-workspace-role-assignment" : decision.reasonCode,
        denialReason: decision.allowed ? undefined : toDenialReason(decision.reasonCode),
        sourceKind: decision.allowed ? "role-grant" : "none",
        targetKind,
        requiredPermissionKey: input.requiredPermission,
        scope: Object.freeze({
          isApplicable: input.scope.kind === DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeKind,
          workspaceId,
          resourceFamily: request.scenario.target.resourceFamily,
          resourceType: request.scenario.target.resourceType,
          resourceId: request.scenario.target.resourceId,
        }),
        matchedRoleAssignmentIds,
        unmatchedRoleAssignmentIds: decision.allowed || candidateRoleAssignmentIds.length === 0
          ? undefined
          : candidateRoleAssignmentIds.filter((id) => !matchedRoleAssignmentIds.includes(id)),
        provenance: Object.freeze({
          decisionService: "workspace-role-based-deployment-policy-administration-permission-service",
        }),
      }),
      runtime: Object.freeze({
        statusCode: decision.allowed ? "ok" : "forbidden",
      }),
    });
  }
}

function toDenialReason(reasonCode?: string): string {
  if (reasonCode === "deployment-policy-permission-invalid-actor-or-scope") {
    return "invalid-context";
  }
  if (reasonCode === "deployment-policy-permission-unsupported-scope") {
    return "unsupported-scope";
  }
  return "insufficient-permissions";
}

function createRoleAssignment(input: {
  readonly id: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly workspaceId?: string;
}): WorkspaceRoleAssignment {
  return createWorkspaceRoleAssignment({
    id: input.id,
    workspaceId: input.workspaceId ?? WORKSPACE_ID,
    userIdentityId: input.userIdentityId,
    role: input.role,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedAt: "2026-04-10T00:00:00.000Z",
    assignedBy: OWNER_USER_ID,
  });
}

function buildScope(scopeId: string): DeploymentPolicyPersistenceScope {
  return Object.freeze({
    kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
    scopeId,
  });
}

function buildAdminDeploymentInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<DeploymentAdminInvariantInput>> {
  const readStateAllowed = Object.freeze({
    scenarioId: "authorization-admin-deployment-state-read-resource-allowed",
    title: "deployment policy state read allows workspace admin role",
    family: InvariantFeatureFamilies.adminDeployment,
    capability: DeploymentPolicyAdministrationPermissionKeys.readState,
    actor: Object.freeze({
      actorUserIdentityId: "user:admin",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze([WorkspaceRoles.admin]),
    }),
    workspace: Object.freeze({
      workspaceId: WORKSPACE_ID,
      ownerUserIdentityId: OWNER_USER_ID,
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.resource,
      resourceFamily: "deployment-policy",
      resourceType: "deployment-policy-scope",
      resourceId: `deployment-policy-scope:${WORKSPACE_ID}`,
      workspaceId: WORKSPACE_ID,
      targetWorkspaceId: WORKSPACE_ID,
    }),
    input: Object.freeze({
      actorUserIdentityId: "user:admin",
      requiredPermission: DeploymentPolicyAdministrationPermissionKeys.readState,
      scope: buildScope(WORKSPACE_ID),
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-assignment:deployment:admin:read-state",
          userIdentityId: "user:admin",
          role: WorkspaceRoles.admin,
        }),
      ]),
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-workspace-role-assignment",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.resource,
        requiredPermissionKey: DeploymentPolicyAdministrationPermissionKeys.readState,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: WORKSPACE_ID,
          resourceFamily: "deployment-policy",
          resourceType: "deployment-policy-scope",
          resourceId: `deployment-policy-scope:${WORKSPACE_ID}`,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:deployment:admin:read-state"]),
        provenance: Object.freeze({
          decisionService: "workspace-role-based-deployment-policy-administration-permission-service",
        }),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "admin-deployment", "state-read", "resource-instance"]),
  });

  const selectProfileDeniedForAdmin = Object.freeze({
    ...readStateAllowed,
    scenarioId: "authorization-admin-deployment-profile-select-capability-denied",
    title: "deployment profile selection denies workspace admin role because owner role is required",
    capability: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
    target: Object.freeze({
      targetKind: InvariantTargetKinds.capability,
      resourceFamily: "deployment-policy",
      resourceType: "deployment-policy-capability",
      resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile}:${WORKSPACE_ID}`,
      workspaceId: WORKSPACE_ID,
      targetWorkspaceId: WORKSPACE_ID,
    }),
    input: Object.freeze({
      actorUserIdentityId: "user:admin",
      requiredPermission: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
      scope: buildScope(WORKSPACE_ID),
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-assignment:deployment:admin:select-profile",
          userIdentityId: "user:admin",
          role: WorkspaceRoles.admin,
        }),
      ]),
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "deployment-policy-permission-admin-role-required",
        denialReason: "insufficient-permissions",
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: "deployment-policy",
          resourceType: "deployment-policy-capability",
          resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile}:${WORKSPACE_ID}`,
        }),
        unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:deployment:admin:select-profile"]),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "admin-deployment", "profile-select", "capability-target"]),
  } satisfies InvariantScenarioDefinition<DeploymentAdminInvariantInput>);

  const manageOverridesAllowedForOwner = Object.freeze({
    ...selectProfileDeniedForAdmin,
    scenarioId: "authorization-admin-deployment-override-manage-capability-allowed",
    title: "deployment override management allows workspace owner role",
    capability: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
    actor: Object.freeze({
      actorUserIdentityId: "user:owner",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze([WorkspaceRoles.owner]),
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.capability,
      resourceFamily: "deployment-policy",
      resourceType: "deployment-policy-capability",
      resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.manageOverrides}:${WORKSPACE_ID}`,
      workspaceId: WORKSPACE_ID,
      targetWorkspaceId: WORKSPACE_ID,
    }),
    input: Object.freeze({
      actorUserIdentityId: "user:owner",
      requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
      scope: buildScope(WORKSPACE_ID),
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-assignment:deployment:owner:manage-overrides",
          userIdentityId: "user:owner",
          role: WorkspaceRoles.owner,
        }),
      ]),
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "allow",
      decision: Object.freeze({
        reasonCode: "matched-workspace-role-assignment",
        sourceKind: "role-grant",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: "deployment-policy",
          resourceType: "deployment-policy-capability",
          resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.manageOverrides}:${WORKSPACE_ID}`,
        }),
        matchedRoleAssignmentIds: Object.freeze(["role-assignment:deployment:owner:manage-overrides"]),
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    }),
    tags: Object.freeze(["authorization", "admin-deployment", "override-manage", "capability-target"]),
  });

  const manageRuntimeAdminOverridesDenyByDefault = Object.freeze({
    ...manageOverridesAllowedForOwner,
    scenarioId: "authorization-admin-deployment-runtime-admin-manage-deny-by-default",
    title: "runtime-admin deployment override management denies by default with no matching role assignments",
    capability: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
    actor: Object.freeze({
      actorUserIdentityId: "user:runtime-admin-member",
      activeWorkspaceId: WORKSPACE_ID,
      roleKeys: Object.freeze([WorkspaceRoles.member]),
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.capability,
      resourceFamily: "deployment-policy",
      resourceType: "deployment-policy-capability",
      resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides}:${WORKSPACE_ID}`,
      workspaceId: WORKSPACE_ID,
      targetWorkspaceId: WORKSPACE_ID,
    }),
    input: Object.freeze({
      actorUserIdentityId: "user:runtime-admin-member",
      requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
      scope: buildScope(WORKSPACE_ID),
      roleAssignments: Object.freeze([]),
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "deployment-policy-permission-admin-role-required",
        denialReason: "insufficient-permissions",
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: "deployment-policy",
          resourceType: "deployment-policy-capability",
          resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides}:${WORKSPACE_ID}`,
        }),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "admin-deployment", "runtime-admin-manage", "deny-by-default", "capability-target"]),
  } satisfies InvariantScenarioDefinition<DeploymentAdminInvariantInput>);

  const invalidActorDenied = Object.freeze({
    ...manageRuntimeAdminOverridesDenyByDefault,
    scenarioId: "authorization-admin-deployment-invalid-actor-context-denied",
    title: "deployment policy administration fails closed when actor context is missing",
    capability: DeploymentPolicyAdministrationPermissionKeys.readState,
    actor: Object.freeze({
      actorUserIdentityId: "",
      activeWorkspaceId: WORKSPACE_ID,
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.capability,
      resourceFamily: "deployment-policy",
      resourceType: "deployment-policy-capability",
      resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.readState}:${WORKSPACE_ID}`,
      workspaceId: WORKSPACE_ID,
      targetWorkspaceId: WORKSPACE_ID,
    }),
    input: Object.freeze({
      actorUserIdentityId: "   ",
      requiredPermission: DeploymentPolicyAdministrationPermissionKeys.readState,
      scope: buildScope(WORKSPACE_ID),
      roleAssignments: Object.freeze([]),
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: "deny",
      decision: Object.freeze({
        reasonCode: "deployment-policy-permission-invalid-actor-or-scope",
        denialReason: "invalid-context",
        sourceKind: "none",
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: DeploymentPolicyAdministrationPermissionKeys.readState,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: WORKSPACE_ID,
          resourceFamily: "deployment-policy",
          resourceType: "deployment-policy-capability",
          resourceId: `capability:${DeploymentPolicyAdministrationPermissionKeys.readState}:${WORKSPACE_ID}`,
        }),
      }),
      runtime: Object.freeze({
        statusCode: "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "admin-deployment", "fail-closed", "deny-by-default", "capability-target"]),
  } satisfies InvariantScenarioDefinition<DeploymentAdminInvariantInput>);

  return Object.freeze([
    readStateAllowed,
    selectProfileDeniedForAdmin,
    manageOverridesAllowedForOwner,
    manageRuntimeAdminOverridesDenyByDefault,
    invalidActorDenied,
  ]);
}

describe("WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService", () => {
  it("covers admin/deployment capability invariants via shared framework", async () => {
    const registry = new InvariantAdapterRegistry().register(new DeploymentPolicyAdministrationInvariantAdapter());
    const scenarios = buildAdminDeploymentInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-admin-deployment-state-read-resource-allowed",
      "authorization-admin-deployment-profile-select-capability-denied",
      "authorization-admin-deployment-override-manage-capability-allowed",
      "authorization-admin-deployment-runtime-admin-manage-deny-by-default",
      "authorization-admin-deployment-invalid-actor-context-denied",
    ]));

    for (const scenario of scenarios) {
      const execution = await executeAndAssertInvariantScenario(registry, {
        scenario,
        now: () => new Date(EVALUATION_AS_OF),
      });

      expect(execution.observed.decision?.reasonCode).toBe(scenario.expectation.decision?.reasonCode);
      expect(execution.observed.decision?.sourceKind).toBe(scenario.expectation.decision?.sourceKind);
    }
  });

  it("keeps deployment admin capability-vs-resource semantics explicit", () => {
    const scenarioKinds = new Set(
      buildAdminDeploymentInvariantScenarios().map((scenario) => scenario.target.targetKind),
    );

    expect(scenarioKinds.has(InvariantTargetKinds.capability)).toBeTrue();
    expect(scenarioKinds.has(InvariantTargetKinds.resource)).toBeTrue();
  });
});
