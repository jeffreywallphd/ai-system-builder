import { describe, expect, it } from "bun:test";
import {
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticReasonCodes,
  AuthorizationRuntimeAvailabilityReasonCodes,
  AuthorizationDenialProvenanceStages,
  AuthorizationDiagnosticContractError,
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticTargetKinds,
  createAuthorizationDiagnosticRecord,
} from "../AuthorizationDiagnosticsContracts";

describe("AuthorizationDiagnosticsContracts", () => {
  it("creates canonical diagnostics for denied evaluator outcomes", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      observedAt: "2026-04-13T10:00:00.000Z",
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

  it("requires requestId or correlationId", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {},
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.route,
    })).toThrow(AuthorizationDiagnosticContractError);
  });

  it("requires target identifiers for resource-instance targets", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {
        requestId: "req-2",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.api,
    })).toThrow("target.targetIdentifier is required");
  });

  it("requires workspace id for workspace-capability targets", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {
        correlationId: "corr-2",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.workspaceCapability,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.useCase,
    })).toThrow("target.targetWorkspaceId is required");
  });

  it("rejects negative counters and invalid extension keys", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {
        requestId: "req-3",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      counts: {
        roleAssignmentCount: -1,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.adapter,
    })).toThrow("roleAssignmentCount must be a non-negative finite number");

    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {
        requestId: "req-4",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.invalidEvaluationContext,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.adapter,
      extensions: {
        invalid: "value",
      },
    })).toThrow("extension key 'invalid' is invalid");
  });

  it("requires runtime evidence when runtime-affected diagnostics are declared", () => {
    expect(() => createAuthorizationDiagnosticRecord({
      correlation: {
        requestId: "req-5",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: AuthorizationRuntimeAvailabilityReasonCodes.runtimeGateBlocked,
      denialProvenanceStage: AuthorizationDenialProvenanceStages.runtimeReadiness,
      runtimeAvailability: {
        affectedByRuntimeAvailability: true,
        degraded: true,
      },
    })).toThrow("marked as affected must include runtime state");
  });

  it("accepts canonical transport-mapping provenance stage and reason code values", () => {
    const diagnostic = createAuthorizationDiagnosticRecord({
      correlation: {
        requestId: "req-transport",
      },
      target: {
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      },
      reasonCode: AuthorizationDiagnosticReasonCodes.transportDenied,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.transportMapping,
    });

    expect(diagnostic.reasonCode).toBe(AuthorizationDiagnosticReasonCodes.transportDenied);
    expect(diagnostic.denialProvenanceStage).toBe(AuthorizationDiagnosticProvenanceStages.transportMapping);
  });
});
