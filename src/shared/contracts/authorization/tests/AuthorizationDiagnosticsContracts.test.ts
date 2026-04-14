import { describe, expect, it } from "bun:test";
import {
  AuthorizationDiagnosticContractError,
  AuthorizationDiagnosticEmissionSurfaces,
  AuthorizationDiagnosticEvidenceKinds,
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticOutcomes,
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticReasonCodes,
  AuthorizationDiagnosticTargetKinds,
  AuthorizationRuntimeAvailabilityReasonCodes,
  createAuthorizationDiagnosticRecord,
  projectAuthorizationDiagnosticRecord,
} from "../AuthorizationDiagnosticsContracts";

describe("AuthorizationDiagnosticsContracts", () => {
  it("creates canonical diagnostics for denied evaluator outcomes", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      observedAt: "2026-04-13T10:00:00.000Z",
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: " req-1 ",
      },
      actor: {
        actorIdentityId: " user-1 ",
        actorActiveWorkspaceId: " workspace-alpha ",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
        targetIdentifier: "asset:asset-1",
        targetWorkspaceId: "workspace-alpha",
        targetResourceFamily: "asset",
        targetResourceType: "asset",
      },
      requiredPermissionKey: "asset.read",
      counts: {
        roleAssignmentCount: 3,
        permissionGrantCount: 2.8,
        sharingGrantCount: 1,
        sharingPolicyMetadataCount: 1,
        applicableScopeCount: 4,
      },
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      reasonCode: AuthorizationDiagnosticReasonCodes.noEffectivePermission,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
      runtimeAvailability: {
        affectedByRuntimeAvailability: true,
        degraded: true,
        runtimeState: "warming",
        blockingReasonCodes: ["capability-warmup-in-progress"],
        dependencyCategory: "capability-activation",
        detail: "runtime readiness delayed authorization result production",
      },
      extensions: {
        "auth.trace-id": "trace-1",
      },
    });

    expect(diagnostic.contractVersion).toBe("authorization-diagnostic/v1");
    expect(diagnostic.correlation.requestId).toBe("req-1");
    expect(diagnostic.actor.actorIdentityId).toBe("user-1");
    expect(diagnostic.actor.actorActiveWorkspaceId).toBe("workspace-alpha");
    expect(diagnostic.counts.permissionGrantCount).toBe(2);
    expect(diagnostic.runtimeAvailability?.degraded).toBeTrue();
    expect(diagnostic.extensions?.["auth.trace-id"]).toBe("trace-1");
  });

  it("requires matched source for allow diagnostics at evaluation stages", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.allow,
      correlation: {
        requestId: "req-allow-source",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
        targetIdentifier: "asset:asset-allow-1",
      },
      requiredPermissionKey: "asset.read",
      reasonCode: AuthorizationDiagnosticReasonCodes.matchedRoleGrant,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
      counts: {
        roleAssignmentCount: 1,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
      },
      evidence: {
        roleAssignmentIds: ["role-1"],
      },
    })).toThrow("must include a matchedSourceKind");
  });

  it("requires requestId or correlationId", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {},
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.route,
    })).toThrow(AuthorizationDiagnosticContractError);
  });

  it("requires target identifiers for resource-instance targets", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-2",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.api,
    })).toThrow("target.targetIdentifier is required");
  });

  it("requires workspace id for workspace-capability targets", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        correlationId: "corr-2",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.workspaceCapability,
      },
      requiredPermissionKey: "system.manage",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.useCase,
    })).toThrow("target.targetWorkspaceId is required");
  });

  it("rejects negative counters and invalid extension keys", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-3",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      counts: {
        roleAssignmentCount: -1,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.adapter,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
    })).toThrow("roleAssignmentCount must be a non-negative finite number");

    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-4",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.adapter,
      extensions: {
        invalid: "value",
      },
    })).toThrow("extension key 'invalid' is invalid");
  });

  it("requires runtime evidence when runtime-affected diagnostics are declared", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.degraded,
      correlation: {
        requestId: "req-5",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: AuthorizationRuntimeAvailabilityReasonCodes.runtimeGateBlocked,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.runtimeReadiness,
      runtimeAvailability: {
        affectedByRuntimeAvailability: true,
        degraded: true,
      },
    })).toThrow("marked as affected must include runtime state");
  });

  it("requires declared missing evidence when evaluator-stage counts are unavailable", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-6",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      reasonCode: AuthorizationDiagnosticReasonCodes.noEffectivePermission,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.evaluator,
    })).toThrow("missing role-assignment evidence");
  });

  it("projects external diagnostics with redacted identifiers and summarized extension visibility", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-7",
      },
      actor: {
        actorIdentityId: "user-99",
        actorActiveWorkspaceId: "workspace-zeta",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
        targetIdentifier: "asset:secret-1",
        targetWorkspaceId: "workspace-zeta",
        targetResourceFamily: "asset",
        targetResourceType: "asset",
      },
      requiredPermissionKey: "asset.update",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      reasonCode: AuthorizationDiagnosticReasonCodes.noEffectivePermission,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
      counts: {
        roleAssignmentCount: 1,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
      },
      evidence: {
        roleAssignmentIds: ["role-1", "role-2"],
        permissionGrantIds: ["grant-1"],
        sharingGrantIds: ["sharing-1"],
      },
      extensions: {
        "ops.note.public": "safe summary",
        "ops.secret": "Bearer abc.def.ghi",
      },
    });

    const external = projectAuthorizationDiagnosticRecord(diagnostic, {
      surface: AuthorizationDiagnosticEmissionSurfaces.external,
      maxIdentifierCount: 1,
      secretSensitiveSurface: true,
    });

    expect(external.actor.actorIdentityId).toBeUndefined();
    expect(external.target.targetIdentifier).toBeUndefined();
    expect(external.requiredPermissionKey).toBeUndefined();
    expect(external.evidence?.roleAssignmentIds).toBeUndefined();
    expect(external.extensions).toBeUndefined();
  });

  it("projects runtime-unavailable diagnostics without leaking sensitive runtime details", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.unavailable,
      correlation: {
        correlationId: "corr-runtime-unavailable",
      },
      actor: {
        actorIdentityId: "service-runtime",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.workspaceCapability,
        targetWorkspaceId: "workspace-runtime",
        targetResourceType: "runtime",
      },
      reasonCode: AuthorizationRuntimeAvailabilityReasonCodes.runtimeGateBlocked,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.runtimeReadiness,
      runtimeAvailability: {
        affectedByRuntimeAvailability: true,
        degraded: false,
        runtimeState: "unavailable",
        detail: "Bearer runtime-secret-token",
      },
      extensions: {
        "runtime.internal.path": "C:\\runtime\\secrets\\state.db",
        "runtime.readiness.public": "runtime gate blocked",
      },
    });

    const external = projectAuthorizationDiagnosticRecord(diagnostic, {
      surface: AuthorizationDiagnosticEmissionSurfaces.external,
      secretSensitiveSurface: false,
    });

    expect(external.runtimeAvailability?.detail).toBe("[REDACTED]");
    expect(external.actor.actorIdentityId).toBeUndefined();
    expect(external.target.targetWorkspaceId).toBe("workspace-runtime");
    expect(external.extensions).toEqual({
      "runtime.readiness.public": "runtime gate blocked",
    });
  });

  it("accepts canonical transport-mapping provenance stage and reason code values", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-transport",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      requiredPermissionKey: "asset.read",
      matchedSourceKind: AuthorizationDiagnosticMatchedSourceKinds.none,
      evidence: {
        missing: [
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ],
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.transportDenied,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.transportMapping,
    });

    expect(diagnostic.reasonCode).toBe(AuthorizationDiagnosticReasonCodes.transportDenied);
    expect(diagnostic.denialProvenanceStage).toBe(AuthorizationDiagnosticProvenanceStages.transportMapping);
  });

  it("allows actor-snapshot context diagnostics without requiredPermissionKey", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.deny,
      correlation: {
        requestId: "req-actor-context",
      },
      actor: {
        actorIdentityId: "user-context",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: "workspace-context-missing",
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.actorSnapshot,
    });

    expect(diagnostic.requiredPermissionKey).toBeUndefined();
    expect(diagnostic.denialProvenanceStage).toBe(AuthorizationDiagnosticProvenanceStages.actorSnapshot);
  });

  it("supports observed context snapshots for non-decision stages", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome: AuthorizationDiagnosticOutcomes.observed,
      correlation: {
        requestId: "req-observed-context",
      },
      actor: {
        actorIdentityId: "user-observed",
        actorActiveWorkspaceId: "workspace-observed",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: "context-snapshot-captured",
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.actorSnapshot,
      extensions: {
        "identity.request-family": "identity",
        "identity.operation-name": "GET /api/v1/identity/session",
      },
    });

    expect(diagnostic.outcome).toBe(AuthorizationDiagnosticOutcomes.observed);
    expect(diagnostic.actor.actorActiveWorkspaceId).toBe("workspace-observed");
  });
});
