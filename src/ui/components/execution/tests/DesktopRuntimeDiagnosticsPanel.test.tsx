import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../../electron/shared/DesktopContracts";
import DesktopRuntimeDiagnosticsPanel from "../DesktopRuntimeDiagnosticsPanel";

function createStatus(overrides: Partial<DesktopPostLoginRuntimeStatus>): DesktopPostLoginRuntimeStatus {
  const updatedAt = overrides.updatedAt ?? "2026-04-12T10:00:00.000Z";
  const state = overrides.state ?? "warming";
  return {
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: overrides.capabilityPhase ?? state,
    updatedAt,
    transport: {
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    },
    ...overrides,
  } as const;
}

describe("DesktopRuntimeDiagnosticsPanel", () => {
  it("renders lifecycle diagnostics from backend runtime status", () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopRuntimeDiagnosticsPanel, {
        runtimeLifecycleStatus: createStatus({
          state: "warming",
          capabilityPhase: "warming",
          updatedAt: "2026-04-12T10:00:04.000Z",
          transport: {
            phase: "available",
            updatedAt: "2026-04-12T10:00:03.000Z",
          },
          activationStages: [
            {
              stageId: "python-runtime-resolution",
              state: "running",
              updatedAt: "2026-04-12T10:00:05.000Z",
              blockingReadiness: true,
              detail: "Resolving python runtime",
            },
          ],
        }),
      }),
    );

    expect(html).toContain("Desktop runtime diagnostics (development)");
    expect(html).toContain("Lifecycle state");
    expect(html).toContain("warming");
    expect(html).toContain("Blocking dependency category");
    expect(html).toContain("capability-activation");
    expect(html).toContain("Recent transition timestamps");
    expect(html).toContain("Inspectable lifecycle snapshot");
  });

  it("renders waiting copy when lifecycle status is unavailable", () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopRuntimeDiagnosticsPanel),
    );

    expect(html).toContain("Runtime lifecycle status has not been reported");
  });
});
