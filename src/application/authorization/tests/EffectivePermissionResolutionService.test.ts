import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createActorContext,
  createPermissionGrant,
  createResourcePolicyContext,
  createRoleAssignment,
  createSharingGrant,
} from "@domain/authorization/AuthorizationDomain";
import { EffectivePermissionResolutionService } from "../use-cases/EffectivePermissionResolutionService";
import {
  extractAuthorizationDiagnosticCorrelationId,
  requireAuthorizationDiagnosticEvent,
} from "./AuthorizationDiagnosticRegressionTestSupport";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

class RecordingDiagnosticsLogger {
  public readonly events: Array<{ readonly event: string; readonly details?: Readonly<Record<string, unknown>> }> = [];

  public info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void {
    this.events.push(event);
  }
}

describe("EffectivePermissionResolutionService", () => {
  const service = new EffectivePermissionResolutionService({
    clock: {
      now: () => new Date(evaluationAsOf),
    },
  });

  const sharedWorkspaceResource = createResourcePolicyContext({
    resourceType: "asset",
    resourceId: "asset-001",
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-alpha",
    visibility: ResourceVisibilities.shared,
    sharingPolicy: {
      mode: SharingPolicyModes.explicit,
      allowResharing: false,
    },
    sharingGrants: [
      createSharingGrant({
        id: "share-user-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-shared",
        },
        permissions: ["asset.read"],
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
      createSharingGrant({
        id: "share-workspace-role-1",
        subject: {
          kind: SharingSubjectKinds.workspaceRole,
          workspaceId: "workspace-alpha",
          roleKey: "member",
        },
        permissions: ["asset.read"],
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ],
  });

  const workspaceVisibleResource = createResourcePolicyContext({
    resourceType: "asset",
    resourceId: "asset-002",
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-alpha",
    visibility: ResourceVisibilities.workspace,
    sharingPolicy: {
      mode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
    },
  });

  const sharedWorkspaceRoleOnlyResource = createResourcePolicyContext({
    resourceType: "asset",
    resourceId: "asset-005",
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-alpha",
    visibility: ResourceVisibilities.shared,
    sharingPolicy: {
      mode: SharingPolicyModes.explicit,
      allowResharing: false,
    },
    sharingGrants: [
      createSharingGrant({
        id: "share-workspace-role-guest-1",
        subject: {
          kind: SharingSubjectKinds.workspaceRole,
          workspaceId: "workspace-alpha",
          roleKey: "guest",
        },
        permissions: ["asset.read"],
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ],
  });

  const publishedResource = createResourcePolicyContext({
    resourceType: "asset",
    resourceId: "asset-003",
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-alpha",
    visibility: ResourceVisibilities.published,
    sharingPolicy: {
      mode: SharingPolicyModes.published,
      allowResharing: false,
    },
    isPublishedCapable: true,
    publishedAt: "2026-04-01T00:00:00.000Z",
  });

  const privateResource = createResourcePolicyContext({
    resourceType: "asset",
    resourceId: "asset-004",
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-alpha",
    visibility: ResourceVisibilities.private,
    sharingPolicy: {
      mode: SharingPolicyModes.ownerOnly,
      allowResharing: false,
    },
  });

  const matrix = [
    {
      name: "role-only allows when workspace role baseline grants permission",
      actor: createActorContext({
        actorUserIdentityId: "user-member",
        roleAssignments: [
          createRoleAssignment({
            id: "role-member-1",
            actorUserIdentityId: "user-member",
            roleKey: "member",
            scope: RoleAssignmentScopes.workspace,
            workspaceId: "workspace-alpha",
            assignedByUserIdentityId: "user-owner",
            assignedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: sharedWorkspaceResource,
      requiredPermissionKey: "asset.update",
      expectedOutcome: "allow",
      expectedReasonCode: "matched-role-grant",
      expectedRoleAssignmentIds: ["role-member-1"],
    },
    {
      name: "owner-only allows without role grants",
      actor: createActorContext({
        actorUserIdentityId: "user-owner",
      }),
      resource: privateResource,
      requiredPermissionKey: "asset.delete",
      expectedOutcome: "allow",
      expectedReasonCode: "owner-override",
    },
    {
      name: "shared user grant allows when explicit grant matches",
      actor: createActorContext({
        actorUserIdentityId: "user-shared",
      }),
      resource: sharedWorkspaceResource,
      requiredPermissionKey: "asset.read",
      expectedOutcome: "allow",
      expectedReasonCode: "matched-sharing-grant",
      expectedSharingGrantIds: ["share-user-1"],
    },
    {
      name: "workspace visibility allows read for active workspace member without role baseline grants",
      actor: createActorContext({
        actorUserIdentityId: "user-guest",
        roleAssignments: [
          createRoleAssignment({
            id: "role-guest-1",
            actorUserIdentityId: "user-guest",
            roleKey: "guest",
            scope: RoleAssignmentScopes.workspace,
            workspaceId: "workspace-alpha",
            assignedByUserIdentityId: "user-owner",
            assignedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: workspaceVisibleResource,
      requiredPermissionKey: "asset.read",
      expectedOutcome: "allow",
      expectedReasonCode: "visibility-workspace-member",
    },
    {
      name: "published visibility allows read for non-member actor",
      actor: createActorContext({
        actorServiceId: "service:public-consumer",
      }),
      resource: publishedResource,
      requiredPermissionKey: "asset.read",
      expectedOutcome: "allow",
      expectedReasonCode: "visibility-published",
    },
    {
      name: "explicit deny overrides owner override",
      actor: createActorContext({
        actorUserIdentityId: "user-owner",
        permissionGrants: [
          createPermissionGrant({
            id: "deny-owner-1",
            permissionKey: "asset.delete",
            effect: PermissionEffects.deny,
            scope: PermissionGrantScopes.resource,
            resourceType: "asset",
            resourceId: "asset-004",
            grantedByUserIdentityId: "user-admin",
            grantedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: privateResource,
      requiredPermissionKey: "asset.delete",
      expectedOutcome: "deny",
      expectedReasonCode: "explicit-deny-permission-grant",
      expectedPermissionGrantIds: ["deny-owner-1"],
    },
    {
      name: "explicit deny overrides role grant",
      actor: createActorContext({
        actorUserIdentityId: "user-member-denied",
        roleAssignments: [
          createRoleAssignment({
            id: "role-member-2",
            actorUserIdentityId: "user-member-denied",
            roleKey: "member",
            scope: RoleAssignmentScopes.workspace,
            workspaceId: "workspace-alpha",
            assignedByUserIdentityId: "user-owner",
            assignedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
        permissionGrants: [
          createPermissionGrant({
            id: "deny-role-1",
            permissionKey: "asset.update",
            effect: PermissionEffects.deny,
            scope: PermissionGrantScopes.workspace,
            workspaceId: "workspace-alpha",
            grantedByUserIdentityId: "user-admin",
            grantedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: sharedWorkspaceResource,
      requiredPermissionKey: "asset.update",
      expectedOutcome: "deny",
      expectedReasonCode: "explicit-deny-permission-grant",
      expectedPermissionGrantIds: ["deny-role-1"],
    },
    {
      name: "sharing workspace-role subject matches actor workspace role",
      actor: createActorContext({
        actorUserIdentityId: "user-shared-by-role",
        roleAssignments: [
          createRoleAssignment({
            id: "role-guest-2",
            actorUserIdentityId: "user-shared-by-role",
            roleKey: "guest",
            scope: RoleAssignmentScopes.workspace,
            workspaceId: "workspace-alpha",
            assignedByUserIdentityId: "user-owner",
            assignedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: sharedWorkspaceRoleOnlyResource,
      requiredPermissionKey: "asset.read",
      expectedOutcome: "allow",
      expectedReasonCode: "matched-sharing-grant",
      expectedSharingGrantIds: ["share-workspace-role-guest-1"],
    },
    {
      name: "default deny for unmatched permission",
      actor: createActorContext({
        actorUserIdentityId: "user-viewer-denied",
        roleAssignments: [
          createRoleAssignment({
            id: "role-viewer-2",
            actorUserIdentityId: "user-viewer-denied",
            roleKey: "viewer",
            scope: RoleAssignmentScopes.workspace,
            workspaceId: "workspace-alpha",
            assignedByUserIdentityId: "user-owner",
            assignedAt: "2026-04-01T00:00:00.000Z",
          }),
        ],
      }),
      resource: privateResource,
      requiredPermissionKey: "asset.update",
      expectedOutcome: "deny",
      expectedReasonCode: "no-effective-permission",
    },
  ] as const;

  for (const scenario of matrix) {
    it(scenario.name, () => {
      const result = service.resolvePermission({
        actor: scenario.actor,
        resource: scenario.resource,
        requiredPermissionKey: scenario.requiredPermissionKey,
        asOf: evaluationAsOf,
      });

      expect(result.decision.outcome).toBe(scenario.expectedOutcome);
      expect(result.decision.reasonCode).toBe(scenario.expectedReasonCode);

      if (scenario.expectedRoleAssignmentIds) {
        expect(result.decision.matchedRoleAssignmentIds).toEqual(scenario.expectedRoleAssignmentIds);
      }
      if (scenario.expectedPermissionGrantIds) {
        expect(result.decision.matchedPermissionGrantIds).toEqual(scenario.expectedPermissionGrantIds);
      }
      if (scenario.expectedSharingGrantIds) {
        expect(result.decision.matchedSharingGrantIds).toEqual(scenario.expectedSharingGrantIds);
      }
    });
  }

  it("resolves capability checks in batch using a stable interface", () => {
    const actor = createActorContext({
      actorUserIdentityId: "user-member-batch",
      roleAssignments: [
        createRoleAssignment({
          id: "role-member-batch-1",
          actorUserIdentityId: "user-member-batch",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ],
    });

    const decisions = service.resolvePermissions({
      actor,
      resource: sharedWorkspaceResource,
      permissionKeys: ["asset.read", "asset.update", "asset.read"],
      asOf: evaluationAsOf,
    });

    expect(decisions).toHaveLength(2);
    expect(decisions.map((decision) => decision.decision.requiredPermissionKey)).toEqual([
      "asset.read",
      "asset.update",
    ]);
    expect(decisions.map((decision) => decision.decision.outcome)).toEqual([
      "allow",
      "allow",
    ]);
  });

  it("emits scope-filtering diagnostics that distinguish applicable vs non-applicable scope evidence", () => {
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    const diagnosticsService = new EffectivePermissionResolutionService({
      clock: {
        now: () => new Date(evaluationAsOf),
      },
      diagnosticsLogger,
    });

    const actor = createActorContext({
      actorUserIdentityId: "user-mismatch",
      roleAssignments: [
        createRoleAssignment({
          id: "role-wrong-workspace-1",
          actorUserIdentityId: "user-mismatch",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-beta",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ],
      permissionGrants: [
        createPermissionGrant({
          id: "grant-wrong-workspace-1",
          permissionKey: "asset.read",
          effect: PermissionEffects.allow,
          scope: PermissionGrantScopes.workspace,
          workspaceId: "workspace-beta",
          grantedByUserIdentityId: "user-owner",
          grantedAt: "2026-04-01T00:00:00.000Z",
        }),
      ],
    });

    const result = diagnosticsService.resolvePermission({
      actor,
      resource: workspaceVisibleResource,
      requiredPermissionKey: "asset.read",
      asOf: evaluationAsOf,
      diagnosticContext: Object.freeze({
        correlationId: "scope-filtering-correlation-1",
        targetKind: "resource-instance",
        targetIdentifier: "asset-002",
        targetWorkspaceId: "workspace-alpha",
        targetResourceType: "asset",
        targetResourceFamily: "asset",
      }),
    });

    expect(result.decision.outcome).toBe("deny");
    const diagnostic = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.scope-filtering.diagnostic",
    );

    expect(diagnostic.denialProvenanceStage).toBe("scope-filtering");
    expect(diagnostic.reasonCode).toBe("scope-mismatch");
    expect(extractAuthorizationDiagnosticCorrelationId(diagnostic)).toBe("scope-filtering-correlation-1");
    expect(diagnostic.counts.roleAssignmentCount).toBe(1);
    expect(diagnostic.counts.permissionGrantCount).toBe(1);
    expect(diagnostic.counts.applicableScopeCount).toBe(0);
    expect(diagnostic.extensions?.["authorization.scope-filtering.non-applicable-scope-count"]).toBe(2);
    expect(diagnostic.extensions?.["authorization.scope-filtering.scope-mismatch-detected"]).toBe(true);
    expect(diagnostic.extensions?.["authorization.scope-filtering.no-applicable-scope"]).toBe(true);
  });
});

