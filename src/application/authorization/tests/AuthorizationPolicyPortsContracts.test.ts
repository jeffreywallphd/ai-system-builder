import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  PolicyDecisionOutcomes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  createPermissionGrant,
  createPolicyDecision,
  createRoleAssignment,
} from "../../../domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "../../../domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationPolicyRecordedEvent,
  AuthorizationActorMembershipLookupQuery,
  AuthorizationActorMembershipRecord,
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationPolicyEvaluatorRequest,
  AuthorizationPolicyEvaluatorResult,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyEvaluationEventTypes } from "../contracts/AuthorizationPolicyEvaluationContracts";
import { EvaluateAuthorizationPolicyUseCase } from "../use-cases/EvaluateAuthorizationPolicyUseCase";
import { EffectivePermissionResolutionService } from "../use-cases/EffectivePermissionResolutionService";
import type { AuthorizationPolicyEvaluationPorts } from "../ports/AuthorizationPolicyEvaluationPorts";
import type { IAuthorizationActorMembershipReadRepository } from "../ports/IAuthorizationActorMembershipReadRepository";
import type { IAuthorizationPolicyEvaluator } from "../ports/IAuthorizationPolicyEvaluator";
import type { IAuthorizationPolicyEventRecorder } from "../ports/IAuthorizationPolicyEventRecorder";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";

class InMemoryAuthorizationPortAdapter
  implements
    IAuthorizationActorMembershipReadRepository,
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository,
    IAuthorizationPolicyEventRecorder {
  public readonly recordedEvents: AuthorizationPolicyRecordedEvent[] = [];

  public actorMemberships: ReadonlyArray<AuthorizationActorMembershipRecord> = Object.freeze([]);
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrants: ReadonlyArray<AuthorizationSharingGrantRecord> = Object.freeze([]);
  public resourcePolicyMetadata?: AuthorizationResourcePolicyMetadata;

  async listActorMemberships(
    _query: AuthorizationActorMembershipLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationActorMembershipRecord>> {
    return this.actorMemberships;
  }

  async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrants;
  }

  async findResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourcePolicyMetadata;
  }

  async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return this.resourcePolicyMetadata ? Object.freeze([this.resourcePolicyMetadata]) : Object.freeze([]);
  }

  async recordPolicyEvaluationEvent(event: AuthorizationPolicyRecordedEvent): Promise<void> {
    this.recordedEvents.push(event);
  }
}

class RoleAwareAllowEvaluator implements IAuthorizationPolicyEvaluator {
  async evaluatePolicy(
    request: AuthorizationPolicyEvaluatorRequest,
  ): Promise<AuthorizationPolicyEvaluatorResult> {
    const matchedRoleAssignment = request.actor.roleAssignments.find((assignment) => (
      assignment.scope === RoleAssignmentScopes.workspace
      && assignment.workspaceId === request.resource.workspaceId
      && assignment.status === "active"
      && assignment.roleKey === "admin"
    ));

    return {
      decision: createPolicyDecision({
        outcome: matchedRoleAssignment ? PolicyDecisionOutcomes.allow : PolicyDecisionOutcomes.deny,
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: matchedRoleAssignment ? "matched-role" : "no-matching-role",
        reason: matchedRoleAssignment
          ? "Actor has an active admin workspace role assignment."
          : "Actor lacks a matching role assignment.",
        evaluatedAt: request.asOf ?? "2026-04-05T16:00:00.000Z",
        matchedRoleAssignmentIds: matchedRoleAssignment ? [matchedRoleAssignment.id] : [],
      }),
    };
  }
}

describe("authorization application policy ports and evaluator seams", () => {
  it("resolves actor/resource context through ports and records evaluation events", async () => {
    const adapter = new InMemoryAuthorizationPortAdapter();
    adapter.actorMemberships = Object.freeze([
      Object.freeze({
        workspaceId: "workspace-alpha",
        userIdentityId: "user-admin",
        status: "active",
        joinedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);
    adapter.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-1",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([
        createPermissionGrant({
          id: "grant-1",
          permissionKey: "asset.read",
          effect: PermissionEffects.allow,
          scope: PermissionGrantScopes.workspace,
          workspaceId: "workspace-alpha",
          grantedByUserIdentityId: "user-owner",
          grantedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
    });
    adapter.resourcePolicyMetadata = Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-101",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: "explicit",
      allowResharing: false,
      isPublishedCapable: false,
    });
    adapter.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-1",
        subject: {
          kind: "user",
          userIdentityId: "user-admin",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);

    const ports: AuthorizationPolicyEvaluationPorts = {
      actorMembershipReadRepository: adapter,
      roleGrantReadRepository: adapter,
      sharingGrantReadRepository: adapter,
      resourcePolicyMetadataReadRepository: adapter,
      policyEvaluator: new RoleAwareAllowEvaluator(),
      policyEventRecorder: adapter,
    };

    const useCase = new EvaluateAuthorizationPolicyUseCase({
      ports,
      clock: {
        now: () => new Date("2026-04-05T16:00:00.000Z"),
      },
    });

    const result = await useCase.execute({
      actor: {
        actorUserIdentityId: "user-admin",
        activeWorkspaceId: "workspace-alpha",
        authenticatedAt: "2026-04-05T15:59:00.000Z",
      },
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-101",
      },
      requiredPermissionKey: "asset.read",
      asOf: "2026-04-05T16:00:00.000Z",
      correlationId: "corr-101",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.decision.outcome).toBe(PolicyDecisionOutcomes.allow);
    expect(result.value.resolvedContext.actorMemberships).toHaveLength(1);
    expect(result.value.resolvedContext.sharingGrants).toHaveLength(1);
    expect(adapter.recordedEvents).toHaveLength(1);
    expect(adapter.recordedEvents[0]?.type).toBe(AuthorizationPolicyEvaluationEventTypes.evaluated);
    expect(adapter.recordedEvents[0]).toMatchObject({
      actor: {
        actorUserIdentityId: "user-admin",
      },
      workspaceId: "workspace-alpha",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-101",
      },
      requiredPermissionKey: "asset.read",
      outcome: "allow",
      reasonCode: "matched-role",
      roleAssignmentCount: 1,
      permissionGrantCount: 1,
      sharingGrantCount: 1,
    });
  });

  it("returns a typed not-found failure when resource policy metadata is missing", async () => {
    const adapter = new InMemoryAuthorizationPortAdapter();
    const ports: AuthorizationPolicyEvaluationPorts = {
      actorMembershipReadRepository: adapter,
      roleGrantReadRepository: adapter,
      sharingGrantReadRepository: adapter,
      resourcePolicyMetadataReadRepository: adapter,
      policyEvaluator: new RoleAwareAllowEvaluator(),
    };

    const useCase = new EvaluateAuthorizationPolicyUseCase({ ports });
    const result = await useCase.execute({
      actor: {
        actorUserIdentityId: "user-admin",
      },
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "missing-asset",
      },
      requiredPermissionKey: "asset.read",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("authorization-evaluation-resource-not-found");
  });

  it("supports the effective-permission resolver as a drop-in policy evaluator", async () => {
    const adapter = new InMemoryAuthorizationPortAdapter();
    adapter.resourcePolicyMetadata = Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-201",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: "workspace-members",
      allowResharing: false,
      isPublishedCapable: false,
    });
    adapter.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-viewer-drop-in",
          actorUserIdentityId: "user-viewer",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const ports: AuthorizationPolicyEvaluationPorts = {
      actorMembershipReadRepository: adapter,
      roleGrantReadRepository: adapter,
      sharingGrantReadRepository: adapter,
      resourcePolicyMetadataReadRepository: adapter,
      policyEvaluator: new EffectivePermissionResolutionService({
        clock: {
          now: () => new Date("2026-04-05T16:00:00.000Z"),
        },
      }),
    };

    const useCase = new EvaluateAuthorizationPolicyUseCase({ ports });
    const result = await useCase.execute({
      actor: {
        actorUserIdentityId: "user-viewer",
        activeWorkspaceId: "workspace-alpha",
      },
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-201",
      },
      requiredPermissionKey: "asset.read",
      asOf: "2026-04-05T16:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.decision.outcome).toBe(PolicyDecisionOutcomes.allow);
    expect(result.value.decision.reasonCode).toBe("visibility-workspace-member");
  });

  it("emits a secondary denied event for denied policy outcomes", async () => {
    const adapter = new InMemoryAuthorizationPortAdapter();
    adapter.resourcePolicyMetadata = Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-201",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: "owner-only",
      allowResharing: false,
      isPublishedCapable: false,
    });

    const ports: AuthorizationPolicyEvaluationPorts = {
      actorMembershipReadRepository: adapter,
      roleGrantReadRepository: adapter,
      sharingGrantReadRepository: adapter,
      resourcePolicyMetadataReadRepository: adapter,
      policyEvaluator: new RoleAwareAllowEvaluator(),
      policyEventRecorder: adapter,
    };

    const useCase = new EvaluateAuthorizationPolicyUseCase({ ports });
    const result = await useCase.execute({
      actor: {
        actorUserIdentityId: "user-viewer",
      },
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-201",
      },
      requiredPermissionKey: "asset.read",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.decision.outcome).toBe("deny");
    expect(adapter.recordedEvents).toHaveLength(2);
    expect(adapter.recordedEvents[0]?.type).toBe(AuthorizationPolicyEvaluationEventTypes.evaluated);
    expect(adapter.recordedEvents[1]?.type).toBe(AuthorizationPolicyEvaluationEventTypes.denied);
    expect(adapter.recordedEvents[1]).toMatchObject({
      outcome: "deny",
      requiredPermissionKey: "asset.read",
      reasonCode: "no-matching-role",
    });
  });
});
