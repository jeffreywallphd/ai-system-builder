import {
  PermissionEffects,
  PermissionGrantScopes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  createActorContext,
  createPermissionGrant,
  createResourcePolicyContext,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
  type CatalogPermissionKey,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import { InvariantFeatureFamilies, InvariantTargetKinds, type InvariantScenarioDefinition } from "./contracts";

const BASELINE_WORKSPACE_ID = "workspace:baseline-alpha";
const BASELINE_RESOURCE_ID = "asset:baseline:1";
const BASELINE_OWNER_USER_ID = "user:baseline-owner";
const BASELINE_EVALUATED_AT = "2026-04-13T00:00:00.000Z";
const BASELINE_ASSIGNED_AT = "2026-04-10T00:00:00.000Z";
const BASELINE_GRANTED_AT = "2026-04-10T00:00:00.000Z";

type AuthorizationInvariantBaselineScenario = InvariantScenarioDefinition<AuthorizationInvariantBaselineInput>;

export interface AuthorizationInvariantBaselineInput {
  readonly actorContext: ReturnType<typeof createActorContext>;
  readonly resourceContext: ReturnType<typeof createResourcePolicyContext>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly asOf: string;
}

export interface AuthorizationBaselineScenarioValidationIssue {
  readonly scenarioId: string;
  readonly message: string;
}

export interface AuthorizationBaselineScenarioBuilders {
  readonly persistedRoleAssignmentPresentAndApplicable: AuthorizationInvariantBaselineScenario;
  readonly synthesizedWorkspaceRoleFallbackApplies: AuthorizationInvariantBaselineScenario;
  readonly scopeMismatchPreventsApplicability: AuthorizationInvariantBaselineScenario;
  readonly explicitDenyPathRemainsDeny: AuthorizationInvariantBaselineScenario;
  readonly visibilityReadAllowedWhileCreateDenied: Readonly<{
    readonly read: AuthorizationInvariantBaselineScenario;
    readonly create: AuthorizationInvariantBaselineScenario;
  }>;
  readonly noApplicablePermissionPath: AuthorizationInvariantBaselineScenario;
  readonly all: ReadonlyArray<AuthorizationInvariantBaselineScenario>;
}

function createWorkspaceResourceContext(
  input?: Partial<{
    workspaceId: string;
    resourceId: string;
    visibility: ReturnType<typeof createResourcePolicyContext>["visibility"];
    ownerUserIdentityId: string;
  }>,
): ReturnType<typeof createResourcePolicyContext> {
  const workspaceId = input?.workspaceId ?? BASELINE_WORKSPACE_ID;
  const visibility = input?.visibility ?? ResourceVisibilities.private;
  const sharingPolicyMode = visibility === ResourceVisibilities.workspace
    ? SharingPolicyModes.workspaceMembers
    : SharingPolicyModes.ownerOnly;

  return createResourcePolicyContext({
    resourceType: "asset",
    resourceId: input?.resourceId ?? BASELINE_RESOURCE_ID,
    ownerUserIdentityId: input?.ownerUserIdentityId ?? BASELINE_OWNER_USER_ID,
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId,
    visibility,
    sharingPolicy: {
      mode: sharingPolicyMode,
      allowResharing: false,
    },
    sharingGrants: [],
    isPublishedCapable: false,
  });
}

function createScenario(
  input: Readonly<{
    scenarioId: string;
    title: string;
    actorContext: ReturnType<typeof createActorContext>;
    resourceContext: ReturnType<typeof createResourcePolicyContext>;
    requiredPermissionKey: CatalogPermissionKey;
    expected: {
      outcome: "allow" | "deny";
      reasonCode: string;
      sourceKind: string;
      matchedRoleAssignmentIds?: ReadonlyArray<string>;
      unmatchedRoleAssignmentIds?: ReadonlyArray<string>;
      matchedPermissionGrantIds?: ReadonlyArray<string>;
      unmatchedPermissionGrantIds?: ReadonlyArray<string>;
    };
    tags?: ReadonlyArray<string>;
  }>,
): AuthorizationInvariantBaselineScenario {
  const workspaceId = input.resourceContext.workspaceId ?? input.actorContext.activeWorkspaceId ?? BASELINE_WORKSPACE_ID;

  return Object.freeze({
    scenarioId: input.scenarioId,
    title: input.title,
    family: InvariantFeatureFamilies.asset,
    capability: input.requiredPermissionKey,
    actor: Object.freeze({
      actorUserIdentityId: input.actorContext.actorUserIdentityId,
      actorServiceId: input.actorContext.actorServiceId,
      activeWorkspaceId: input.actorContext.activeWorkspaceId,
      roleKeys: input.actorContext.roleAssignments.map((roleAssignment) => roleAssignment.roleKey),
    }),
    workspace: Object.freeze({
      workspaceId,
      ownerUserIdentityId: input.resourceContext.ownerUserIdentityId,
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.resource,
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: input.resourceContext.resourceType,
      resourceId: input.resourceContext.resourceId,
      workspaceId,
      targetWorkspaceId: workspaceId,
      ownerUserIdentityId: input.resourceContext.ownerUserIdentityId,
    }),
    resource: Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: input.resourceContext.resourceType,
      resourceId: input.resourceContext.resourceId,
      workspaceId,
      ownerUserIdentityId: input.resourceContext.ownerUserIdentityId,
    }),
    input: Object.freeze({
      actorContext: input.actorContext,
      resourceContext: input.resourceContext,
      requiredPermissionKey: input.requiredPermissionKey,
      asOf: BASELINE_EVALUATED_AT,
    }),
    expectation: Object.freeze({
      outcome: input.expected.outcome,
      decision: Object.freeze({
        reasonCode: input.expected.reasonCode,
        sourceKind: input.expected.sourceKind,
        requiredPermissionKey: input.requiredPermissionKey,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: input.resourceContext.workspaceId ? "workspace" : "resource",
          workspaceId: input.resourceContext.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: input.resourceContext.resourceType,
          resourceId: input.resourceContext.resourceId,
        }),
        matchedRoleAssignmentIds: input.expected.matchedRoleAssignmentIds,
        unmatchedRoleAssignmentIds: input.expected.unmatchedRoleAssignmentIds,
        matchedPermissionGrantIds: input.expected.matchedPermissionGrantIds,
        unmatchedPermissionGrantIds: input.expected.unmatchedPermissionGrantIds,
      }),
      runtime: Object.freeze({
        statusCode: input.expected.outcome === "allow" ? "ok" : "forbidden",
      }),
    }),
    tags: Object.freeze(input.tags ?? ["authorization", "baseline-invariant-scenario"]),
  });
}

export function buildPersistedRoleAssignmentPresentAndApplicableScenario(): AuthorizationInvariantBaselineScenario {
  const roleAssignmentId = "role-assignment:persisted:workspace-alpha:member";
  const actorContext = createActorContext({
    actorUserIdentityId: "user:baseline-member",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [
      createRoleAssignment({
        id: roleAssignmentId,
        actorUserIdentityId: "user:baseline-member",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: BASELINE_WORKSPACE_ID,
        assignedByUserIdentityId: BASELINE_OWNER_USER_ID,
        assignedAt: BASELINE_ASSIGNED_AT,
      }),
    ],
  });
  const resourceContext = createWorkspaceResourceContext();
  return createScenario({
    scenarioId: "authorization-baseline-persisted-role-assignment-applicable",
    title: "persisted workspace role assignment grants matching permission",
    actorContext,
    resourceContext,
    requiredPermissionKey: "asset.update",
    expected: Object.freeze({
      outcome: "allow",
      reasonCode: "matched-role-grant",
      sourceKind: "role-grant",
      matchedRoleAssignmentIds: Object.freeze([roleAssignmentId]),
    }),
    tags: Object.freeze(["authorization", "baseline", "persisted-role-assignment"]),
  });
}

export function buildSynthesizedWorkspaceRoleFallbackScenario(): AuthorizationInvariantBaselineScenario {
  const synthesizedRoleAssignmentId = "synthetic-role-assignment:workspace-alpha:user-owner-fallback:owner";
  const actorContext = createActorContext({
    actorUserIdentityId: "user:owner-fallback",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [
      createRoleAssignment({
        id: synthesizedRoleAssignmentId,
        actorUserIdentityId: "user:owner-fallback",
        roleKey: "owner",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: BASELINE_WORKSPACE_ID,
        assignedByUserIdentityId: "user:owner-fallback",
        assignedAt: BASELINE_ASSIGNED_AT,
      }),
    ],
  });
  const resourceContext = createWorkspaceResourceContext({
    ownerUserIdentityId: BASELINE_OWNER_USER_ID,
  });
  return createScenario({
    scenarioId: "authorization-baseline-synthesized-workspace-role-fallback",
    title: "synthesized workspace role fallback grants owner capability without persisted role row",
    actorContext,
    resourceContext,
    requiredPermissionKey: "asset.create",
    expected: Object.freeze({
      outcome: "allow",
      reasonCode: "matched-role-grant",
      sourceKind: "role-grant",
      matchedRoleAssignmentIds: Object.freeze([synthesizedRoleAssignmentId]),
    }),
    tags: Object.freeze(["authorization", "baseline", "workspace-role-fallback"]),
  });
}

export function buildScopeMismatchPreventsApplicabilityScenario(): AuthorizationInvariantBaselineScenario {
  const mismatchedRoleAssignmentId = "role-assignment:persisted:workspace-beta:member";
  const actorContext = createActorContext({
    actorUserIdentityId: "user:scope-mismatch",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [
      createRoleAssignment({
        id: mismatchedRoleAssignmentId,
        actorUserIdentityId: "user:scope-mismatch",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:baseline-beta",
        assignedByUserIdentityId: BASELINE_OWNER_USER_ID,
        assignedAt: BASELINE_ASSIGNED_AT,
      }),
    ],
  });
  const resourceContext = createWorkspaceResourceContext();
  return createScenario({
    scenarioId: "authorization-baseline-scope-mismatch-prevents-applicability",
    title: "workspace scope mismatch keeps role assignment inapplicable",
    actorContext,
    resourceContext,
    requiredPermissionKey: "asset.update",
    expected: Object.freeze({
      outcome: "deny",
      reasonCode: "no-effective-permission",
      sourceKind: "none",
      unmatchedRoleAssignmentIds: Object.freeze([mismatchedRoleAssignmentId]),
    }),
    tags: Object.freeze(["authorization", "baseline", "scope-mismatch"]),
  });
}

export function buildExplicitDenyPathRemainsDenyScenario(): AuthorizationInvariantBaselineScenario {
  const matchedRoleAssignmentId = "role-assignment:persisted:workspace-alpha:member-with-deny";
  const explicitDenyPermissionGrantId = "permission-grant:deny:workspace-alpha:asset-update";
  const actorContext = createActorContext({
    actorUserIdentityId: "user:explicit-deny",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [
      createRoleAssignment({
        id: matchedRoleAssignmentId,
        actorUserIdentityId: "user:explicit-deny",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: BASELINE_WORKSPACE_ID,
        assignedByUserIdentityId: BASELINE_OWNER_USER_ID,
        assignedAt: BASELINE_ASSIGNED_AT,
      }),
    ],
    permissionGrants: [
      createPermissionGrant({
        id: explicitDenyPermissionGrantId,
        permissionKey: "asset.update",
        effect: PermissionEffects.deny,
        scope: PermissionGrantScopes.workspace,
        workspaceId: BASELINE_WORKSPACE_ID,
        grantedByUserIdentityId: BASELINE_OWNER_USER_ID,
        grantedAt: BASELINE_GRANTED_AT,
      }),
    ],
  });
  const resourceContext = createWorkspaceResourceContext();
  return createScenario({
    scenarioId: "authorization-baseline-explicit-deny-remains-deny",
    title: "explicit deny grant keeps decision denied even when role could allow",
    actorContext,
    resourceContext,
    requiredPermissionKey: "asset.update",
    expected: Object.freeze({
      outcome: "deny",
      reasonCode: "explicit-deny-permission-grant",
      sourceKind: "explicit-deny",
      matchedPermissionGrantIds: Object.freeze([explicitDenyPermissionGrantId]),
      unmatchedRoleAssignmentIds: Object.freeze([matchedRoleAssignmentId]),
    }),
    tags: Object.freeze(["authorization", "baseline", "explicit-deny"]),
  });
}

export function buildVisibilityReadListVsCreateWriteScenarios(): Readonly<{
  readonly read: AuthorizationInvariantBaselineScenario;
  readonly create: AuthorizationInvariantBaselineScenario;
}> {
  const workspaceMembershipRoleAssignmentId = "role-assignment:workspace-membership-context:workspace-alpha:guest";
  const actorContext = createActorContext({
    actorUserIdentityId: "user:workspace-guest",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [
      createRoleAssignment({
        id: workspaceMembershipRoleAssignmentId,
        actorUserIdentityId: "user:workspace-guest",
        roleKey: "guest",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: BASELINE_WORKSPACE_ID,
        assignedByUserIdentityId: BASELINE_OWNER_USER_ID,
        assignedAt: BASELINE_ASSIGNED_AT,
      }),
    ],
  });
  const resourceContext = createWorkspaceResourceContext({
    visibility: ResourceVisibilities.workspace,
  });

  return Object.freeze({
    read: createScenario({
      scenarioId: "authorization-baseline-visibility-read-allowed",
      title: "workspace visibility allows read/list while baseline role grants do not apply",
      actorContext,
      resourceContext,
      requiredPermissionKey: "asset.read",
      expected: Object.freeze({
        outcome: "allow",
        reasonCode: "visibility-workspace-member",
        sourceKind: "visibility-rule",
        unmatchedRoleAssignmentIds: Object.freeze([workspaceMembershipRoleAssignmentId]),
      }),
      tags: Object.freeze(["authorization", "baseline", "read-list-vs-create-write", "visibility-read"]),
    }),
    create: createScenario({
      scenarioId: "authorization-baseline-visibility-create-denied",
      title: "workspace visibility does not authorize create/write permission",
      actorContext,
      resourceContext,
      requiredPermissionKey: "asset.create",
      expected: Object.freeze({
        outcome: "deny",
        reasonCode: "no-effective-permission",
        sourceKind: "none",
        unmatchedRoleAssignmentIds: Object.freeze([workspaceMembershipRoleAssignmentId]),
      }),
      tags: Object.freeze(["authorization", "baseline", "read-list-vs-create-write", "create-write-denied"]),
    }),
  });
}

export function buildNoApplicablePermissionPathScenario(): AuthorizationInvariantBaselineScenario {
  const actorContext = createActorContext({
    actorServiceId: "service:policy-checker",
    activeWorkspaceId: BASELINE_WORKSPACE_ID,
    roleAssignments: [],
    permissionGrants: [],
  });
  const resourceContext = createWorkspaceResourceContext();
  return createScenario({
    scenarioId: "authorization-baseline-no-applicable-permission-path",
    title: "deny when no role grant, permission grant, sharing grant, or visibility rule applies",
    actorContext,
    resourceContext,
    requiredPermissionKey: "asset.read",
    expected: Object.freeze({
      outcome: "deny",
      reasonCode: "no-effective-permission",
      sourceKind: "none",
    }),
    tags: Object.freeze(["authorization", "baseline", "no-applicable-permission"]),
  });
}

export function buildAuthorizationBaselineScenarioBuilders(): AuthorizationBaselineScenarioBuilders {
  const persistedRoleAssignmentPresentAndApplicable = buildPersistedRoleAssignmentPresentAndApplicableScenario();
  const synthesizedWorkspaceRoleFallbackApplies = buildSynthesizedWorkspaceRoleFallbackScenario();
  const scopeMismatchPreventsApplicability = buildScopeMismatchPreventsApplicabilityScenario();
  const explicitDenyPathRemainsDeny = buildExplicitDenyPathRemainsDenyScenario();
  const visibilityReadAllowedWhileCreateDenied = buildVisibilityReadListVsCreateWriteScenarios();
  const noApplicablePermissionPath = buildNoApplicablePermissionPathScenario();

  const all = Object.freeze([
    persistedRoleAssignmentPresentAndApplicable,
    synthesizedWorkspaceRoleFallbackApplies,
    scopeMismatchPreventsApplicability,
    explicitDenyPathRemainsDeny,
    visibilityReadAllowedWhileCreateDenied.read,
    visibilityReadAllowedWhileCreateDenied.create,
    noApplicablePermissionPath,
  ]);

  return Object.freeze({
    persistedRoleAssignmentPresentAndApplicable,
    synthesizedWorkspaceRoleFallbackApplies,
    scopeMismatchPreventsApplicability,
    explicitDenyPathRemainsDeny,
    visibilityReadAllowedWhileCreateDenied,
    noApplicablePermissionPath,
    all,
  });
}

function collectKnownRoleAssignmentIds(
  input: AuthorizationInvariantBaselineInput,
): ReadonlySet<string> {
  return new Set(input.actorContext.roleAssignments.map((roleAssignment) => roleAssignment.id));
}

function collectKnownPermissionGrantIds(
  input: AuthorizationInvariantBaselineInput,
): ReadonlySet<string> {
  return new Set(input.actorContext.permissionGrants.map((permissionGrant) => permissionGrant.id));
}

export function validateAuthorizationBaselineScenario(
  scenario: AuthorizationInvariantBaselineScenario,
): ReadonlyArray<AuthorizationBaselineScenarioValidationIssue> {
  const issues: AuthorizationBaselineScenarioValidationIssue[] = [];
  const input = scenario.input;

  if (!input) {
    issues.push({
      scenarioId: scenario.scenarioId,
      message: "Scenario input is required.",
    });
    return Object.freeze(issues);
  }

  if (scenario.capability !== input.requiredPermissionKey) {
    issues.push({
      scenarioId: scenario.scenarioId,
      message: `Scenario capability '${scenario.capability}' must match input.requiredPermissionKey '${input.requiredPermissionKey}'.`,
    });
  }

  if (scenario.target.resourceId !== input.resourceContext.resourceId) {
    issues.push({
      scenarioId: scenario.scenarioId,
      message: "Target resourceId must match input.resourceContext.resourceId.",
    });
  }

  if (scenario.target.workspaceId !== input.resourceContext.workspaceId) {
    issues.push({
      scenarioId: scenario.scenarioId,
      message: "Target workspaceId must match input.resourceContext.workspaceId.",
    });
  }

  const expectedDecision = scenario.expectation.decision;
  const knownRoleAssignmentIds = collectKnownRoleAssignmentIds(input);
  const knownPermissionGrantIds = collectKnownPermissionGrantIds(input);

  for (const roleAssignmentId of expectedDecision?.matchedRoleAssignmentIds ?? []) {
    if (!knownRoleAssignmentIds.has(roleAssignmentId)) {
      issues.push({
        scenarioId: scenario.scenarioId,
        message: `Expected matched role assignment '${roleAssignmentId}' is not present in actor context.`,
      });
    }
  }

  for (const roleAssignmentId of expectedDecision?.unmatchedRoleAssignmentIds ?? []) {
    if (!knownRoleAssignmentIds.has(roleAssignmentId)) {
      issues.push({
        scenarioId: scenario.scenarioId,
        message: `Expected unmatched role assignment '${roleAssignmentId}' is not present in actor context.`,
      });
    }
  }

  for (const permissionGrantId of expectedDecision?.matchedPermissionGrantIds ?? []) {
    if (!knownPermissionGrantIds.has(permissionGrantId)) {
      issues.push({
        scenarioId: scenario.scenarioId,
        message: `Expected matched permission grant '${permissionGrantId}' is not present in actor context.`,
      });
    }
  }

  for (const permissionGrantId of expectedDecision?.unmatchedPermissionGrantIds ?? []) {
    if (!knownPermissionGrantIds.has(permissionGrantId)) {
      issues.push({
        scenarioId: scenario.scenarioId,
        message: `Expected unmatched permission grant '${permissionGrantId}' is not present in actor context.`,
      });
    }
  }

  return Object.freeze(issues);
}
