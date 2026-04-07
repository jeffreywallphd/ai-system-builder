import { describe, expect, it } from "bun:test";
import { OfflineResourceClasses } from "@domain/platform/OfflineLocalModeBoundaries";
import {
  DesktopOfflineLocalModeProfileError,
  assertDesktopOfflineLocalModeAuthorityBoundary,
  inspectDesktopOfflineLocalModeProfile,
  resolveDesktopOfflineResourceBoundary,
} from "../DesktopOfflineLocalModeProfile";

describe("DesktopOfflineLocalModeProfile", () => {
  it("keeps desktop runtime in control-plane-client posture for offline behavior", () => {
    const inspection = inspectDesktopOfflineLocalModeProfile();
    expect(inspection.hostId).toBe("host:desktop:app-shell");
    expect(inspection.isControlPlaneClient).toBeTrue();
    expect(inspection.isAuthoritativeControlPlane).toBeFalse();
    expect(() => assertDesktopOfflineLocalModeAuthorityBoundary()).not.toThrow();
  });

  it("allows bounded offline resource classes and rejects disallowed classes", () => {
    const workflowBoundary = resolveDesktopOfflineResourceBoundary(OfflineResourceClasses.workflowDraft);
    expect(workflowBoundary.offlineCapabilities.edit).toBeTrue();

    expect(() => resolveDesktopOfflineResourceBoundary(OfflineResourceClasses.secretPlaintextMaterial))
      .toThrow(DesktopOfflineLocalModeProfileError);
  });
});
