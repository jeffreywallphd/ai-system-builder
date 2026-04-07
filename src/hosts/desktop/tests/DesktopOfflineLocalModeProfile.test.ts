import { describe, expect, it } from "bun:test";
import {
  OfflineLocalExecutionClasses,
  OfflineResourceClasses,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  DesktopOfflineLocalModeProfileError,
  assertDesktopOfflineLocalModeAuthorityBoundary,
  evaluateDesktopOfflineLocalExecutionEligibility,
  inspectDesktopOfflineLocalModeProfile,
  resolveDesktopOfflineResourceBoundary,
} from "../DesktopOfflineLocalModeProfile";

describe("DesktopOfflineLocalModeProfile", () => {
  it("keeps desktop runtime in control-plane-client posture for offline behavior", () => {
    const inspection = inspectDesktopOfflineLocalModeProfile();
    expect(inspection.hostId).toBe("host:desktop:app-shell");
    expect(inspection.isControlPlaneClient).toBeTrue();
    expect(inspection.isAuthoritativeControlPlane).toBeFalse();
    expect(inspection.supportedExecutionClasses).toContain(OfflineLocalExecutionClasses.localWorkflowPreview);
    expect(() => assertDesktopOfflineLocalModeAuthorityBoundary()).not.toThrow();
  });

  it("allows bounded offline resource classes and rejects disallowed classes", () => {
    const workflowBoundary = resolveDesktopOfflineResourceBoundary(OfflineResourceClasses.workflowDraft);
    expect(workflowBoundary.offlineCapabilities.edit).toBeTrue();

    expect(() => resolveDesktopOfflineResourceBoundary(OfflineResourceClasses.secretPlaintextMaterial))
      .toThrow(DesktopOfflineLocalModeProfileError);
  });

  it("allows supported local execution classes and rejects unsupported ones", () => {
    const eligible = evaluateDesktopOfflineLocalExecutionEligibility({
      executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourcePolicy: {
        workspaceVisibility: "private",
        workspaceAccessRole: "owner",
        workspaceSharingPosture: "workspace-only",
        sensitivityMarking: "sensitive",
        storageRule: "require-encrypted-offline-cache",
        deviceTrustPosture: "trusted",
      },
      workstationMode: "interactive-user-session",
      allowOfflineExecutionByPolicy: true,
      allowAuthoritativeRegistrationByPolicy: true,
    });
    expect(eligible.allowed).toBeTrue();
    expect(eligible.requiresLaterAuthoritativeRegistration).toBeTrue();

    expect(() => evaluateDesktopOfflineLocalExecutionEligibility({
      executionClass: OfflineLocalExecutionClasses.distributedClusterRun,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourcePolicy: {
        workspaceVisibility: "private",
        workspaceAccessRole: "owner",
        workspaceSharingPosture: "workspace-only",
        sensitivityMarking: "standard",
        storageRule: "allow-offline-cache",
        deviceTrustPosture: "trusted",
      },
      workstationMode: "interactive-user-session",
      allowOfflineExecutionByPolicy: true,
      allowAuthoritativeRegistrationByPolicy: true,
    })).toThrow(DesktopOfflineLocalModeProfileError);
  });
});
