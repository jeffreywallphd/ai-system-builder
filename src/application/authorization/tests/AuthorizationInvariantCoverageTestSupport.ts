import type {
  PermissionGrant,
  ResourceOwnershipScope,
  ResourceVisibility,
  RoleAssignment,
  SharingGrant,
  SharingPolicyMode,
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
import { AuthorizationPolicyEvaluationTargetKinds } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import { InvariantTargetKinds, type InvariantEvaluationRequest, type InvariantFamilyAdapter, type InvariantFeatureFamily, type InvariantObservedResult, type InvariantScenarioDefinition } from "../../../testing/invariants";

export const INVARIANT_EVALUATION_AS_OF = "2026-04-13T00:00:00.000Z";
export const INVARIANT_ROLE_ASSIGNED_AT = "2026-04-10T00:00:00.000Z";

interface AuthorizationResourceInstanceInvariantInput {
  readonly mode: "resource-instance";
  readonly actor: AuthorizationActorReference;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
  readonly sharingGrants?: ReadonlyArray<SharingGrant>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly asOf: string;
  readonly resource: Readonly<{
    readonly resourceFamily: AuthorizationResourceFamily;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly ownerUserIdentityId: string;
    readonly ownershipScope: ResourceOwnershipScope;
    readonly workspaceId?: string;
    readonly visibility: ResourceVisibility;
    readonly sharingPolicyMode: SharingPolicyMode;
    readonly allowResharing: boolean;
    readonly isPublishedCapable: boolean;
    readonly publishedAt?: string;
  }>;
}

interface AuthorizationWorkspaceCapabilityInvariantInput {
  readonly mode: "workspace-capability";
  readonly actor: AuthorizationActorReference;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly workspaceId: string;
  readonly capabilityResourceType: string;
  readonly asOf: string;
}

export type AuthorizationInvariantCoverageInput =
  | AuthorizationResourceInstanceInvariantInput
  | AuthorizationWorkspaceCapabilityInvariantInput;

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

export class AuthorizationPolicyInvariantAdapter implements InvariantFamilyAdapter<AuthorizationInvariantCoverageInput> {
  public constructor(public readonly family: InvariantFeatureFamily) {}

  public async evaluate(
    request: InvariantEvaluationRequest<AuthorizationInvariantCoverageInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' must include invariant input.`);
    }

    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: input.roleAssignments,
      permissionGrants: input.permissionGrants,
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: {
        now: () => new Date(request.evaluatedAt),
      },
    });

    if (input.mode === "workspace-capability") {
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

    repositories.sharingGrantRecords = (input.sharingGrants ?? []).map((sharingGrant) => toSharingGrantRecord(sharingGrant));
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey(input.resource.resourceType, input.resource.resourceId),
      Object.freeze({
        resourceFamily: input.resource.resourceFamily,
        resourceType: input.resource.resourceType,
        resourceId: input.resource.resourceId,
        ownerUserIdentityId: input.resource.ownerUserIdentityId,
        ownershipScope: input.resource.ownershipScope,
        workspaceId: input.resource.workspaceId,
        visibility: input.resource.visibility,
        sharingPolicyMode: input.resource.sharingPolicyMode,
        allowResharing: input.resource.allowResharing,
        isPublishedCapable: input.resource.isPublishedCapable,
        publishedAt: input.resource.publishedAt,
      }),
    );

    const evaluation = await evaluator.evaluateDecision({
      actor: input.actor,
      requiredPermissionKey: input.requiredPermissionKey,
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: input.resource.resourceFamily,
          resourceType: input.resource.resourceType,
          resourceId: input.resource.resourceId,
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

function toSharingGrantRecord(sharingGrant: SharingGrant): AuthorizationSharingGrantRecord {
  return Object.freeze({
    id: sharingGrant.id,
    subject: sharingGrant.subject,
    permissionKeys: sharingGrant.permissions,
    grantedByUserIdentityId: sharingGrant.grantedByUserIdentityId,
    grantedAt: sharingGrant.grantedAt,
    expiresAt: sharingGrant.expiresAt,
    revokedAt: sharingGrant.revokedAt,
  });
}

function toResourceKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

export function buildCapabilityTargetResourceId(input: {
  readonly permissionKey: CatalogPermissionKey;
  readonly workspaceId: string;
}): string {
  return `capability:${input.permissionKey}:${input.workspaceId}`;
}

export function buildResourceTarget(input: {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
}) {
  return Object.freeze({
    targetKind: InvariantTargetKinds.resource,
    resourceFamily: input.resourceFamily,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    workspaceId: input.workspaceId,
    targetWorkspaceId: input.workspaceId,
    ownerUserIdentityId: input.ownerUserIdentityId,
  });
}

export function buildCapabilityTarget(input: {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly permissionKey: CatalogPermissionKey;
  readonly workspaceId: string;
}) {
  return Object.freeze({
    targetKind: InvariantTargetKinds.capability,
    resourceFamily: input.resourceFamily,
    resourceType: input.resourceType,
    resourceId: buildCapabilityTargetResourceId({
      permissionKey: input.permissionKey,
      workspaceId: input.workspaceId,
    }),
    workspaceId: input.workspaceId,
    targetWorkspaceId: input.workspaceId,
  });
}

export function buildDefaultResourceInvariantInput(input: {
  readonly actor: AuthorizationActorReference;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants?: ReadonlyArray<PermissionGrant>;
  readonly sharingGrants?: ReadonlyArray<SharingGrant>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
  readonly asOf?: string;
}): AuthorizationResourceInstanceInvariantInput {
  return Object.freeze({
    mode: "resource-instance",
    actor: input.actor,
    roleAssignments: input.roleAssignments,
    permissionGrants: input.permissionGrants ?? Object.freeze([]),
    sharingGrants: input.sharingGrants,
    requiredPermissionKey: input.requiredPermissionKey,
    asOf: input.asOf ?? INVARIANT_EVALUATION_AS_OF,
    resource: Object.freeze({
      resourceFamily: input.resourceFamily,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ownerUserIdentityId: input.ownerUserIdentityId,
      ownershipScope: "workspace",
      workspaceId: input.workspaceId,
      visibility: "private",
      sharingPolicyMode: "owner-only",
      allowResharing: false,
      isPublishedCapable: false,
    }),
  });
}

export function buildDefaultCapabilityInvariantInput(input: {
  readonly actor: AuthorizationActorReference;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants?: ReadonlyArray<PermissionGrant>;
  readonly requiredPermissionKey: CatalogPermissionKey;
  readonly workspaceId: string;
  readonly capabilityResourceType: string;
  readonly asOf?: string;
}): AuthorizationWorkspaceCapabilityInvariantInput {
  return Object.freeze({
    mode: "workspace-capability",
    actor: input.actor,
    roleAssignments: input.roleAssignments,
    permissionGrants: input.permissionGrants ?? Object.freeze([]),
    requiredPermissionKey: input.requiredPermissionKey,
    workspaceId: input.workspaceId,
    capabilityResourceType: input.capabilityResourceType,
    asOf: input.asOf ?? INVARIANT_EVALUATION_AS_OF,
  });
}

export function defaultResourceFamilyForInvariantFamily(family: InvariantFeatureFamily): AuthorizationResourceFamily {
  if (family === "workflow") {
    return AuthorizationResourceFamilies.workflow;
  }
  if (family === "run") {
    return AuthorizationResourceFamilies.run;
  }
  return AuthorizationResourceFamilies.asset;
}
