import { describe, expect, it } from "bun:test";
import {
  RoleAssignmentScopes,
  createRoleAssignment,
  type PermissionGrant,
  type RoleAssignment,
  type SharingGrant,
} from "@domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
  type AuthorizationResourceFamily,
  type CatalogPermissionKey,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationActorReference,
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  InvariantTargetKinds,
  buildAuthorizationBaselineScenarioBuilders,
  executeAndAssertInvariantScenario,
  type AuthorizationInvariantBaselineInput,
  type InvariantEvaluationRequest,
  type InvariantFamilyAdapter,
  type InvariantObservedResult,
  type InvariantScenarioDefinition,
} from "../../../testing/invariants";

const EVALUATION_AS_OF = "2026-04-13T00:00:00.000Z";
const ROLE_ASSIGNED_AT = "2026-04-10T00:00:00.000Z";

interface AssetWorkspaceCapabilityInvariantInput {
  readonly mode: "workspace-capability";
  readonly actor: AuthorizationActorReference;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly workspaceId: string;
  readonly capabilityResourceType: string;
  readonly asOf: string;
}

type AssetInvariantScenarioInput =
  | AuthorizationInvariantBaselineInput
  | AssetWorkspaceCapabilityInvariantInput;

class InMemoryDecisionPolicyRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrantRecords: ReadonlyArray<AuthorizationSharingGrantRecord> = Object.freeze([]);
  public resourcePolicyMetadataByResourceKey = new Map<string, AuthorizationResourcePolicyMetadata>();

  async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrantRecords;
  }

  async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourcePolicyMetadataByResourceKey.get(toResourceKey(query.resource.resourceType, query.resource.resourceId));
  }

  async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourcePolicyMetadataByResourceKey.values()]);
  }
}

class AssetAuthorizationInvariantAdapter implements InvariantFamilyAdapter<AssetInvariantScenarioInput> {
  public readonly family = InvariantFeatureFamilies.asset;

  public async evaluate(
    request: InvariantEvaluationRequest<AssetInvariantScenarioInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' must include invariant input.`);
    }

    const repositories = new InMemoryDecisionPolicyRepositories();
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: {
        now: () => new Date(request.evaluatedAt),
      },
    });

    if (isWorkspaceCapabilityInput(input)) {
      repositories.roleGrantSnapshot = Object.freeze({
        roleAssignments: input.roleAssignments,
        permissionGrants: input.permissionGrants,
      });

      const evaluation = await evaluator.evaluateDecision({
        actor: input.actor,
        requiredPermissionKey: input.requiredPermissionKey,
        target: {
          kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
          workspaceId: input.workspaceId,
          capabilityResourceType: input.capabilityResourceType,
        },
        asOf: input.asOf,
        includeDebugDetails: true,
      });

      return toObservedResult(request.scenario, evaluation);
    }

    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: input.actorContext.roleAssignments,
      permissionGrants: input.actorContext.permissionGrants,
    });
    repositories.sharingGrantRecords = input.resourceContext.sharingGrants.map((sharingGrant) =>
      toSharingGrantRecord(sharingGrant)
    );
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey(input.resourceContext.resourceType, input.resourceContext.resourceId),
      Object.freeze({
        resourceFamily: request.scenario.target.resourceFamily as AuthorizationResourceFamily,
        resourceType: input.resourceContext.resourceType,
        resourceId: input.resourceContext.resourceId,
        ownerUserIdentityId: input.resourceContext.ownerUserIdentityId,
        ownershipScope: input.resourceContext.ownershipScope,
        workspaceId: input.resourceContext.workspaceId,
        visibility: input.resourceContext.visibility,
        sharingPolicyMode: input.resourceContext.sharingPolicy.mode,
        allowResharing: input.resourceContext.sharingPolicy.allowResharing,
        isPublishedCapable: input.resourceContext.isPublishedCapable,
        publishedAt: input.resourceContext.publishedAt,
      }),
    );

    const evaluation = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: input.actorContext.actorUserIdentityId,
        actorServiceId: input.actorContext.actorServiceId,
        activeWorkspaceId: input.actorContext.activeWorkspaceId,
      },
      requiredPermissionKey: input.requiredPermissionKey,
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: request.scenario.target.resourceFamily as AuthorizationResourceFamily,
          resourceType: input.resourceContext.resourceType,
          resourceId: input.resourceContext.resourceId,
        },
      },
      asOf: input.asOf,
      includeDebugDetails: true,
    });

    return toObservedResult(request.scenario, evaluation);
  }
}

function toObservedResult(
  scenario: InvariantScenarioDefinition,
  evaluation: Awaited<ReturnType<AuthorizationPolicyDecisionEvaluator["evaluateDecision"]>>,
): InvariantObservedResult {
  const workspaceId = scenario.target.targetWorkspaceId
    ?? scenario.target.workspaceId
    ?? scenario.resource?.workspaceId
    ?? scenario.workspace.workspaceId;
  const targetKind = evaluation.debug?.targetKind === AuthorizationPolicyEvaluationTargetKinds.workspaceCapability
    ? InvariantTargetKinds.capability
    : InvariantTargetKinds.resource;
  const scopeKind = targetKind === InvariantTargetKinds.capability ? "workspace-capability" : "workspace";

  return Object.freeze({
    outcome: evaluation.decision.outcome,
    decision: Object.freeze({
      reasonCode: evaluation.decision.reasonCode,
      denialReason: evaluation.decision.denialReason,
      sourceKind: evaluation.debug?.sourceKind,
      targetKind,
      requiredPermissionKey: evaluation.decision.requiredPermissionKey,
      scope: Object.freeze({
        isApplicable: true,
        scopeKind,
        workspaceId,
        resourceFamily: scenario.target.resourceFamily,
        resourceType: scenario.target.resourceType,
        resourceId: scenario.target.resourceId,
      }),
      matchedRoleAssignmentIds: evaluation.decision.matchedRoleAssignmentIds,
      matchedPermissionGrantIds: evaluation.decision.matchedPermissionGrantIds,
      matchedSharingGrantIds: evaluation.decision.matchedSharingGrantIds,
    }),
    runtime: Object.freeze({
      statusCode: evaluation.decision.isAllowed ? "ok" : "forbidden",
    }),
  });
}

function toSharingGrantRecord(grant: SharingGrant): AuthorizationSharingGrantRecord {
  return Object.freeze({
    id: grant.id,
    subject: grant.subject,
    permissionKeys: grant.permissions,
    grantedByUserIdentityId: grant.grantedByUserIdentityId,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
  });
}

function isWorkspaceCapabilityInput(
  input: AssetInvariantScenarioInput,
): input is AssetWorkspaceCapabilityInvariantInput {
  return (input as AssetWorkspaceCapabilityInvariantInput).mode === "workspace-capability";
}

function buildWorkspaceCapabilityScenario(input: {
  readonly scenarioId: string;
  readonly title: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: string;
  readonly roleAssignmentId: string;
  readonly workspaceId: string;
  readonly expected: {
    readonly outcome: "allow" | "deny";
    readonly reasonCode: string;
    readonly denialReason?: string;
    readonly sourceKind: string;
    readonly matchedRoleAssignmentIds?: ReadonlyArray<string>;
    readonly unmatchedRoleAssignmentIds?: ReadonlyArray<string>;
  };
}): InvariantScenarioDefinition<AssetWorkspaceCapabilityInvariantInput> {
  const roleAssignment = createRoleAssignment({
    id: input.roleAssignmentId,
    actorUserIdentityId: input.actorUserIdentityId,
    roleKey: input.roleKey,
    scope: RoleAssignmentScopes.workspace,
    workspaceId: input.workspaceId,
    assignedByUserIdentityId: "user:owner",
    assignedAt: ROLE_ASSIGNED_AT,
  });

  return Object.freeze({
    scenarioId: input.scenarioId,
    title: input.title,
    family: InvariantFeatureFamilies.asset,
    capability: "asset.create",
    actor: Object.freeze({
      actorUserIdentityId: input.actorUserIdentityId,
      activeWorkspaceId: input.workspaceId,
      roleKeys: Object.freeze([input.roleKey]),
    }),
    workspace: Object.freeze({
      workspaceId: input.workspaceId,
      ownerUserIdentityId: "user:owner",
    }),
    target: Object.freeze({
      targetKind: InvariantTargetKinds.capability,
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: `capability:asset.create:${input.workspaceId}`,
      workspaceId: input.workspaceId,
      targetWorkspaceId: input.workspaceId,
    }),
    input: Object.freeze({
      mode: "workspace-capability",
      actor: Object.freeze({
        actorUserIdentityId: input.actorUserIdentityId,
        activeWorkspaceId: input.workspaceId,
      }),
      roleAssignments: Object.freeze([roleAssignment]),
      permissionGrants: Object.freeze([]),
      requiredPermissionKey: "asset.create",
      workspaceId: input.workspaceId,
      capabilityResourceType: "asset",
      asOf: EVALUATION_AS_OF,
    }),
    expectation: Object.freeze({
      outcome: input.expected.outcome,
      decision: Object.freeze({
        reasonCode: input.expected.reasonCode,
        denialReason: input.expected.denialReason,
        sourceKind: input.expected.sourceKind,
        targetKind: InvariantTargetKinds.capability,
        requiredPermissionKey: "asset.create",
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: input.workspaceId,
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
        }),
        matchedRoleAssignmentIds: input.expected.matchedRoleAssignmentIds,
        unmatchedRoleAssignmentIds: input.expected.unmatchedRoleAssignmentIds,
      }),
      runtime: Object.freeze({
        statusCode: input.expected.outcome === "allow" ? "ok" : "forbidden",
      }),
    }),
    tags: Object.freeze(["authorization", "asset", "workspace-capability"]),
  });
}

function buildAssetInvariantScenarios(): ReadonlyArray<InvariantScenarioDefinition<AssetInvariantScenarioInput>> {
  const baseline = buildAuthorizationBaselineScenarioBuilders();
  const selectedBaselineScenarios: ReadonlyArray<InvariantScenarioDefinition<AssetInvariantScenarioInput>> = Object.freeze([
    baseline.persistedRoleAssignmentPresentAndApplicable,
    baseline.explicitDenyPathRemainsDeny,
    baseline.visibilityReadAllowedWhileCreateDenied.read,
    baseline.visibilityReadAllowedWhileCreateDenied.create,
    baseline.scopeMismatchPreventsApplicability,
  ]);

  const workspaceCapabilityAllowed = buildWorkspaceCapabilityScenario({
    scenarioId: "authorization-asset-workspace-capability-create-allowed",
    title: "workspace capability target allows create when workspace role grants permission",
    actorUserIdentityId: "user:capability-member",
    roleKey: "member",
    roleAssignmentId: "role-assignment:workspace-capability:member",
    workspaceId: "workspace:capability-alpha",
    expected: Object.freeze({
      outcome: "allow",
      reasonCode: "matched-role-grant",
      sourceKind: "role-grant",
      matchedRoleAssignmentIds: Object.freeze(["role-assignment:workspace-capability:member"]),
    }),
  });
  const workspaceCapabilityDenied = buildWorkspaceCapabilityScenario({
    scenarioId: "authorization-asset-workspace-capability-create-denied",
    title: "workspace capability target denies create when role lacks permission",
    actorUserIdentityId: "user:capability-viewer",
    roleKey: "viewer",
    roleAssignmentId: "role-assignment:workspace-capability:viewer",
    workspaceId: "workspace:capability-alpha",
    expected: Object.freeze({
      outcome: "deny",
      reasonCode: "no-effective-permission",
      denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
      sourceKind: "none",
      unmatchedRoleAssignmentIds: Object.freeze(["role-assignment:workspace-capability:viewer"]),
    }),
  });

  return Object.freeze([
    ...selectedBaselineScenarios,
    workspaceCapabilityAllowed,
    workspaceCapabilityDenied,
  ]);
}

describe("Asset authorization invariant coverage", () => {
  it("covers high-signal asset permission slices via shared invariant framework", async () => {
    const registry = new InvariantAdapterRegistry().register(new AssetAuthorizationInvariantAdapter());
    const scenarios = buildAssetInvariantScenarios();

    expect(scenarios.map((scenario) => scenario.scenarioId)).toEqual(expect.arrayContaining([
      "authorization-baseline-persisted-role-assignment-applicable",
      "authorization-baseline-explicit-deny-remains-deny",
      "authorization-baseline-visibility-read-allowed",
      "authorization-baseline-visibility-create-denied",
      "authorization-baseline-scope-mismatch-prevents-applicability",
      "authorization-asset-workspace-capability-create-allowed",
      "authorization-asset-workspace-capability-create-denied",
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

  it("keeps explicit deny precedence stable for asset mutation slices", async () => {
    const registry = new InvariantAdapterRegistry().register(new AssetAuthorizationInvariantAdapter());
    const scenario = buildAssetInvariantScenarios()
      .find((candidate) => candidate.scenarioId === "authorization-baseline-explicit-deny-remains-deny");
    expect(scenario).toBeDefined();

    const execution = await executeAndAssertInvariantScenario(registry, {
      scenario: scenario!,
      now: () => new Date(EVALUATION_AS_OF),
    });

    expect(execution.observed.decision?.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant,
    );
    expect(execution.observed.decision?.matchedPermissionGrantIds).toEqual(
      expect.arrayContaining(["permission-grant:deny:workspace-alpha:asset-update"]),
    );
  });
});

function toResourceKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}
