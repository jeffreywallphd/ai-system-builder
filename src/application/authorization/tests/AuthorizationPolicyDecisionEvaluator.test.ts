import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  PolicyDecisionOutcomes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createPermissionGrant,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
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
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationAdapterFailureReasonCodes } from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";
import {
  extractAuthorizationDiagnosticCorrelationId,
  requireAuthorizationDiagnosticEvent,
} from "./AuthorizationDiagnosticRegressionTestSupport";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

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
  public roleGrantSnapshotError?: Error;
  public sharingGrantLookupError?: Error;
  public resourcePolicyMetadataLookupError?: Error;
  public roleGrantSnapshotMalformed = false;
  public sharingGrantRecordsMalformed = false;

  async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    if (this.roleGrantSnapshotError) {
      throw this.roleGrantSnapshotError;
    }
    if (this.roleGrantSnapshotMalformed) {
      return undefined as unknown as AuthorizationActorRoleGrantSnapshot;
    }
    return this.roleGrantSnapshot;
  }

  async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    if (this.sharingGrantLookupError) {
      throw this.sharingGrantLookupError;
    }
    if (this.sharingGrantRecordsMalformed) {
      return undefined as unknown as ReadonlyArray<AuthorizationSharingGrantRecord>;
    }
    return this.sharingGrantRecords;
  }

  async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    if (this.resourcePolicyMetadataLookupError) {
      throw this.resourcePolicyMetadataLookupError;
    }
    return this.resourcePolicyMetadataByResourceKey.get(toResourceKey(query.resource.resourceType, query.resource.resourceId));
  }

  async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourcePolicyMetadataByResourceKey.values()]);
  }
}

class RecordingDiagnosticsLogger {
  public readonly events: Array<{ readonly event: string; readonly details?: Readonly<Record<string, unknown>> }> = [];

  public info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void {
    this.events.push(event);
  }
}

class ThrowOnFinalDecisionDiagnosticLogger extends RecordingDiagnosticsLogger {
  public override info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void {
    if (event.event === "authorization.final-decision.diagnostic") {
      throw new Error("final-decision-diagnostic-failed");
    }
    super.info(event);
  }
}

describe("AuthorizationPolicyDecisionEvaluator", () => {
  it("allows shared-resource reads when sharing grants match actor identity", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-shared-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-shared-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.sharingGrantRecords = Object.freeze([
      Object.freeze({
        id: "share-actor-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-shared",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: {
        now: () => new Date(evaluationAsOf),
      },
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-shared",
        activeWorkspaceId: "workspace-alpha",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-shared-1",
        },
      },
      asOf: evaluationAsOf,
      includeDebugDetails: true,
    });

    expect(result.decision.isAllowed).toBe(true);
    expect(result.decision.reasonCode).toBe("matched-sharing-grant");
    expect(result.decision.matchedSharingGrantIds).toEqual(["share-actor-1"]);
    expect(result.debug?.targetKind).toBe("resource-instance");
    expect(result.debug?.sharingGrantCount).toBe(1);
  });

  it("emits complete decisive-stage diagnostics for allow outcomes with shared correlation", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-allow-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-allow-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-member-allow-1",
          actorUserIdentityId: "user-member",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
        activeWorkspaceId: "workspace-alpha",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-allow-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("allow");
    expect(result.decision.reasonCode).toBe("matched-role-grant");

    const evaluatorResolution = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.evaluator-resolution.diagnostic",
    );
    const finalDecision = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.final-decision.diagnostic",
    );

    expect(evaluatorResolution.denialProvenanceStage).toBe("evaluator-resolution");
    expect(finalDecision.denialProvenanceStage).toBe("final-decision-emission");
    expect(evaluatorResolution.reasonCode).toBe("matched-role-grant");
    expect(finalDecision.reasonCode).toBe("matched-role-grant");
    expect(evaluatorResolution.requiredPermissionKey).toBe("asset.read");
    expect(finalDecision.requiredPermissionKey).toBe("asset.read");
    expect(evaluatorResolution.matchedSourceKind).toBe("role-grant");
    expect(finalDecision.matchedSourceKind).toBe("role-grant");

    const correlationId = extractAuthorizationDiagnosticCorrelationId(evaluatorResolution);
    expect(correlationId).toBeDefined();
    expect(extractAuthorizationDiagnosticCorrelationId(finalDecision)).toBe(correlationId);
  });

  it("returns stable denial reason when explicit deny grant matches", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-deny-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-deny-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([]),
      permissionGrants: Object.freeze([
        createPermissionGrant({
          id: "deny-1",
          permissionKey: "asset.update",
          effect: PermissionEffects.deny,
          scope: PermissionGrantScopes.workspace,
          workspaceId: "workspace-alpha",
          grantedByUserIdentityId: "user-admin",
          grantedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.update",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-deny-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("deny");
    expect(result.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant,
    );
    expect(result.decision.matchedPermissionGrantIds).toEqual(["deny-1"]);
  });

  it("returns deterministic deny when resource policy metadata is missing", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "missing-resource",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("deny");
    expect(result.decision.reasonCode).toBe("resource-policy-metadata-not-found");
    expect(result.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound,
    );
  });

  it("supports workspace-scoped capability checks without loading a resource instance", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-member-1",
          actorUserIdentityId: "user-member",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    const allowed = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId: "workspace-alpha",
        capabilityResourceType: "asset",
      },
      asOf: evaluationAsOf,
    });

    expect(allowed.decision.isAllowed).toBe(true);
    expect(allowed.decision.reasonCode).toBe("matched-role-grant");

    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-viewer-1",
          actorUserIdentityId: "user-viewer",
          roleKey: "viewer",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const denied = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-viewer",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId: "workspace-alpha",
        capabilityResourceType: "asset",
      },
      asOf: evaluationAsOf,
      includeDebugDetails: true,
    });

    expect(denied.decision.outcome).toBe("deny");
    expect(denied.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
    );
    expect(denied.debug?.targetKind).toBe("workspace-capability");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("auth.decision.role-snapshot.query");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("auth.decision.workspace-capability.evaluate");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("auth.decision.completed");

    const completedEvent = diagnosticsLogger.events.find((event) => (
      event.event === "auth.decision.completed"
      && typeof event.details?.diagnosticCorrelationId === "string"
    ));

    expect(completedEvent).toBeDefined();
    const permissionSnapshot = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.permission-snapshot.diagnostic",
    );
    const scopeFiltering = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.scope-filtering.diagnostic",
    );
    const finalDecision = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.final-decision.diagnostic",
    );
    const evaluatorResolution = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.evaluator-resolution.diagnostic",
    );

    expect(permissionSnapshot.denialProvenanceStage).toBe("permission-snapshot");
    expect(permissionSnapshot.target.kind).toBe("workspace-capability");
    expect(permissionSnapshot.target.targetWorkspaceId).toBe("workspace-alpha");
    expect(permissionSnapshot.counts.roleAssignmentCount).toBe(1);
    expect(permissionSnapshot.counts.permissionGrantCount).toBe(0);
    expect(permissionSnapshot.extensions?.["authorization.permission-snapshot.synthesized-fallback-used"]).toBe(true);

    expect(scopeFiltering.denialProvenanceStage).toBe("scope-filtering");
    expect(scopeFiltering.reasonCode).toBe("authorization.scope-filtering.applicable-scopes");
    expect(scopeFiltering.counts.applicableScopeCount).toBeGreaterThanOrEqual(1);
    expect(scopeFiltering.extensions?.["authorization.scope-filtering.visibility-fallback-used"]).toBe(false);

    expect(evaluatorResolution.denialProvenanceStage).toBe("evaluator-resolution");
    expect(evaluatorResolution.reasonCode).toBe("no-effective-permission");
    expect(evaluatorResolution.matchedSourceKind).toBe("none");
    expect(evaluatorResolution.counts.applicableScopeCount).toBeGreaterThanOrEqual(1);

    expect(finalDecision.denialProvenanceStage).toBe("final-decision-emission");
    expect(finalDecision.reasonCode).toBe("no-effective-permission");
    expect(finalDecision.counts.applicableScopeCount).toBeGreaterThanOrEqual(1);
    expect(diagnosticsLogger.events.map((event) => event.event)).not.toContain("authorization.adapter-failure.diagnostic");

    const correlationId = extractAuthorizationDiagnosticCorrelationId(permissionSnapshot);
    expect(correlationId).toBeDefined();
    expect(extractAuthorizationDiagnosticCorrelationId(scopeFiltering)).toBe(correlationId);
    expect(extractAuthorizationDiagnosticCorrelationId(evaluatorResolution)).toBe(correlationId);
    expect(extractAuthorizationDiagnosticCorrelationId(finalDecision)).toBe(correlationId);
    expect(completedEvent?.details?.diagnosticCorrelationId).toBe(correlationId);
  });

  it("preserves decision outcome when final diagnostic emission fails", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new ThrowOnFinalDecisionDiagnosticLogger();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-member-allow-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-member-allow-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-member-allow-1",
          actorUserIdentityId: "user-member",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-member-allow-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe(PolicyDecisionOutcomes.allow);
    expect(result.decision.reasonCode).toBe("matched-role-grant");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("authorization.evaluator-resolution.diagnostic");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("authorization.decision-diagnostic.emission-failed");
    expect(diagnosticsLogger.events.map((event) => event.event)).toContain("auth.decision.completed");
  });

  it("emits adapter-failure provenance when role snapshot lookup times out", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    repositories.roleGrantSnapshotError = new Error("ETIMEDOUT while querying authorization role snapshot");
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-timeout",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-timeout-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("deny");
    expect(result.decision.reasonCode).toBe("authorization-evaluation-invalid-context");
    const adapterFailureDiagnostic = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.adapter-failure.diagnostic",
    );
    const finalDecisionDiagnostic = requireAuthorizationDiagnosticEvent(
      diagnosticsLogger.events,
      "authorization.final-decision.diagnostic",
    );

    expect(adapterFailureDiagnostic.denialProvenanceStage).toBe("adapter-failure");
    expect(adapterFailureDiagnostic.reasonCode).toBe(AuthorizationAdapterFailureReasonCodes.adapterTimeout);
    expect(adapterFailureDiagnostic.extensions?.["authorization.adapter-failure.repository-operation"]).toBe("role-grant-snapshot");
    expect(finalDecisionDiagnostic.reasonCode).toBe("authorization-evaluation-invalid-context");
    expect(extractAuthorizationDiagnosticCorrelationId(adapterFailureDiagnostic))
      .toBe(extractAuthorizationDiagnosticCorrelationId(finalDecisionDiagnostic));
  });

  it("emits adapter-failure provenance for unexpected empty repository results", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    repositories.roleGrantSnapshotMalformed = true;
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-empty",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-empty-1",
        },
      },
      asOf: evaluationAsOf,
    });

    const adapterFailureEvent = diagnosticsLogger.events.find((event) => (
      event.event === "authorization.adapter-failure.diagnostic"
    ));
    expect(adapterFailureEvent).toBeDefined();
    const adapterFailureDiagnostic = adapterFailureEvent?.details?.diagnostic as {
      readonly reasonCode: string;
      readonly extensions?: Readonly<Record<string, unknown>>;
    };
    expect(adapterFailureDiagnostic.reasonCode).toBe(AuthorizationAdapterFailureReasonCodes.unexpectedEmptyResult);
    expect(adapterFailureDiagnostic.extensions?.["authorization.adapter-failure.unexpected-empty-result"]).toBe(true);
  });

  it("emits adapter-failure provenance for persistence mapping failures", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const diagnosticsLogger = new RecordingDiagnosticsLogger();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-mapping-failure-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-mapping-failure-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.sharingGrantLookupError = new Error(
      "Persisted sharing subject kind 'workspace-role' is missing workspace or role fields.",
    );
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      diagnosticsLogger,
    });

    await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-mapping",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-mapping-failure-1",
        },
      },
      asOf: evaluationAsOf,
    });

    const adapterFailureEvent = diagnosticsLogger.events.find((event) => (
      event.event === "authorization.adapter-failure.diagnostic"
    ));
    expect(adapterFailureEvent).toBeDefined();
    const adapterFailureDiagnostic = adapterFailureEvent?.details?.diagnostic as {
      readonly reasonCode: string;
      readonly extensions?: Readonly<Record<string, unknown>>;
    };
    expect(adapterFailureDiagnostic.reasonCode).toBe(AuthorizationAdapterFailureReasonCodes.persistenceMappingFailed);
    expect(adapterFailureDiagnostic.extensions?.["authorization.adapter-failure.mapping-failure-detected"]).toBe(true);
  });

  it("uses workspace visibility fallback for read/list when actor has workspace membership context", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("log", "log-visibility-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: "log",
        resourceId: "log-visibility-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-guest-1",
          actorUserIdentityId: "user-guest",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-guest",
      },
      requiredPermissionKey: "log.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.log,
          resourceType: "log",
          resourceId: "log-visibility-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.isAllowed).toBe(true);
    expect(result.decision.reasonCode).toBe("visibility-workspace-member");
    expect(result.debug).toBeUndefined();
  });
});

function toResourceKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}
