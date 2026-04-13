import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../../electron/shared/DesktopContracts";
import McpRuntimeStatusPanel, { resolveRuntimeLifecyclePresentation } from "../McpRuntimeStatusPanel";

function createLifecycleStatus(overrides: Partial<DesktopPostLoginRuntimeStatus>): DesktopPostLoginRuntimeStatus {
  const updatedAt = overrides.updatedAt ?? "2026-04-10T12:00:00.000Z";
  const state = overrides.state ?? "ready";
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

describe("McpRuntimeStatusPanel", () => {
  it("renders runtime ready state and discovered tool names", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpRuntimeStatusPanel, {
        status: {
          enabled: true,
          state: "ready",
          checkedAt: new Date().toISOString(),
          servers: [{ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } }],
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
        runtimeLifecycleStatus: createLifecycleStatus({ state: "ready" }),
        tools: [
          { serverId: "local", name: "echo", inputSchema: { type: "object" } },
          { serverId: "local", name: "sum_numbers", inputSchema: { type: "object" } },
        ],
        servers: [],
      }),
    );

    expect(html).toContain("MCP Runtime");
    expect(html).toContain("Runtime status");
    expect(html).toContain("Ready");
    expect(html).toContain("Available tools: echo, sum_numbers");
  });

  it("renders failed lifecycle state with retry affordance and diagnostics", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpRuntimeStatusPanel, {
        tools: [],
        servers: [],
        runtimeAppState: "failed",
        runtimeAppStateDetail: "service supervisor startup timed out",
        runtimeLifecycleStatus: createLifecycleStatus({
          state: "failed",
          capabilityPhase: "failed",
          failure: {
            message: "service supervisor startup timed out",
            failedAt: "2026-04-10T12:00:00.000Z",
            retryable: true,
          },
        }),
        onRestartRuntime: () => undefined,
      }),
    );

    expect(html).toContain("Needs attention");
    expect(html).toContain("Retry startup");
    expect(html).toContain("runtime=failed");
    expect(html).toContain("failure=service supervisor startup timed out");
  });

  it("maps warmup lifecycle state to non-technical startup copy", () => {
    const presentation = resolveRuntimeLifecyclePresentation({
      status: createLifecycleStatus({
        state: "warming",
        capabilityPhase: "warming",
      }),
      runtimeAppState: "starting",
      runtimeAppStateDetail: "starting background services",
      isRuntimeUnavailable: true,
    });

    expect(presentation.state).toBe("warming");
    expect(presentation.title).toBe("Starting");
    expect(presentation.message).toContain("still starting");
    expect(presentation.canRetry).toBeFalse();
    expect(presentation.diagnostics).toContain("runtime=warming");
  });
});
