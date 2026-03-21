import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { createRuntimeEvent, RuntimeEventSources } from "../../../../application/runtime/RuntimeEvent";
import ManagedServicesPanel from "../ManagedServicesPanel";

describe("ManagedServicesPanel", () => {
  it("renders service metadata, lifecycle controls, custom-service actions, and a recent log viewer", () => {
    const html = renderToStaticMarkup(
      React.createElement(ManagedServicesPanel, {
        services: [
          {
            id: "python-runtime",
            name: "Python runtime",
            kind: "python-runtime",
            source: "builtin",
            description: "Local FastAPI worker",
            startPolicy: "on-demand",
            restartPolicy: "on-failure",
            state: "running",
            ownership: "managed",
            isAvailable: true,
            transport: "http",
            baseUrl: "http://127.0.0.1:8000",
            endpointSummary: "http://127.0.0.1:8000/health",
            workingDirectory: "python-runtime",
            command: "python",
            args: ["-m", "uvicorn"],
            environmentVariables: {},
            startupTimeoutMs: 20000,
            canEdit: true,
            canRemove: false,
            canManageLifecycle: true,
            lastCheckedAt: "2026-03-20T10:15:00.000Z",
            lastErrorDetail: undefined,
            detail: "Healthy",
            recentLogs: [
              createRuntimeEvent({
                source: RuntimeEventSources.pythonRuntime,
                severity: "info",
                message: "stdout: runtime ready",
                timestamp: "2026-03-20T10:14:00.000Z",
              }),
            ],
          },
        ],
        selectedServiceId: "python-runtime",
        recentLogs: [
          createRuntimeEvent({
            source: RuntimeEventSources.pythonRuntime,
            severity: "error",
            message: "stderr: traceback line",
            timestamp: "2026-03-20T10:16:00.000Z",
          }),
        ],
        isLoading: false,
        isMutating: false,
        onSelectService: () => undefined,
        onRefresh: () => undefined,
        onStart: () => undefined,
        onStop: () => undefined,
        onRestart: () => undefined,
        onEnsureRunning: () => undefined,
        onCreateService: () => undefined,
        onUpdateService: () => undefined,
        onRemoveService: () => undefined,
      }),
    );

    expect(html).toContain("Managed runtime services");
    expect(html).toContain("Add custom service");
    expect(html).toContain("Python runtime");
    expect(html).toContain("Current state");
    expect(html).toContain("Edit service");
    expect(html).toContain("Recent stdout/stderr and supervisor events");
    expect(html).toContain("stderr: traceback line");
  });
});
