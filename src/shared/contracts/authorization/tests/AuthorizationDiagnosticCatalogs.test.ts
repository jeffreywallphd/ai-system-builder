import { describe, expect, it } from "bun:test";
import {
  AuthorizationContextResolutionReasonCodes,
  AuthorizationDecisionDenialReasonCodes,
  AuthorizationDecisionReasonCodes,
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticReasonCodes,
  AuthorizationRuntimeAvailabilityReasonCodes,
  AuthorizationTransportMappingReasonCodes,
  isKnownAuthorizationDiagnosticReasonCode,
} from "../AuthorizationDiagnosticCatalogs";

describe("AuthorizationDiagnosticCatalogs", () => {
  it("maintains stable cross-category reason-code catalogs", () => {
    expect(AuthorizationDecisionReasonCodes.explicitDenyPermissionGrant).toBe("explicit-deny-permission-grant");
    expect(AuthorizationDecisionDenialReasonCodes.scopeMismatch).toBe("scope-mismatch");
    expect(AuthorizationRuntimeAvailabilityReasonCodes.runtimeGateBlocked).toBe("runtime-gate-blocked");
    expect(AuthorizationTransportMappingReasonCodes.transportDenied).toBe("transport-denied");
    expect(AuthorizationContextResolutionReasonCodes.workspaceContextMissing).toBe("workspace-context-missing");
    expect(AuthorizationDiagnosticReasonCodes.transportDenied).toBe("transport-denied");
    expect(AuthorizationDiagnosticReasonCodes.contextSnapshotCaptured).toBe("context-snapshot-captured");
  });

  it("includes canonical provenance stages for evaluator, decision emission, and transport mapping", () => {
    expect(AuthorizationDiagnosticProvenanceStages.actorSnapshot).toBe("actor-snapshot");
    expect(AuthorizationDiagnosticProvenanceStages.permissionSnapshot).toBe("permission-snapshot");
    expect(AuthorizationDiagnosticProvenanceStages.scopeFiltering).toBe("scope-filtering");
    expect(AuthorizationDiagnosticProvenanceStages.evaluatorResolution).toBe("evaluator-resolution");
    expect(AuthorizationDiagnosticProvenanceStages.finalDecisionEmission).toBe("final-decision-emission");
    expect(AuthorizationDiagnosticProvenanceStages.adapterFailure).toBe("adapter-failure");
    expect(AuthorizationDiagnosticProvenanceStages.transportMapping).toBe("transport-mapping");
  });

  it("distinguishes known diagnostic reason codes from unknown values", () => {
    expect(isKnownAuthorizationDiagnosticReasonCode("transport-denied")).toBeTrue();
    expect(isKnownAuthorizationDiagnosticReasonCode("not-a-known-reason")).toBeFalse();
  });
});
