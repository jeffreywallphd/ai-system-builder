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
            capabilities: ["workflow-execution"],
            dependencies: [],
            dependents: ["vector-store"],
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
            pid: 4100,
            uptimeSeconds: 125,
            healthSummary: "Python runtime is ready.",
            healthCheckedAt: "2026-03-20T10:15:00.000Z",
            canEdit: true,
            canRemove: false,
            canManageLifecycle: true,
            lastCheckedAt: "2026-03-20T10:15:00.000Z",
            lastErrorDetail: undefined,
            detail: "Healthy",
            provisioning: {
              state: "provisioned",
              required: true,
              needsReprovision: false,
              requestedVersion: "3.12",
              resolvedVersion: "3.12.7",
              resolvedInterpreter: "C:/Python312/python.exe",
              environmentPath: "python-runtime/.venv",
              detail: "Python runtime environment is provisioned.",
              availableActions: ["repair", "recreate-environment"] as const,
            },
            readiness: {
              isReady: true,
              detail: "Python runtime is ready.",
              blockedBy: [],
            },
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
        streamState: "live",
        onSelectService: () => undefined,
        onRefresh: () => undefined,
        onStart: () => undefined,
        onStop: () => undefined,
        onRestart: () => undefined,
        onEnsureRunning: () => undefined,
        onProvision: () => undefined,
        onRepair: () => undefined,
        onRecreateEnvironment: () => undefined,
        onStartCapability: () => undefined,
        onCreateService: () => undefined,
        onUpdateService: () => undefined,
        onRemoveService: () => undefined,
      }),
    );

    expect(html).toContain("Managed runtime services");
    expect(html).toContain("Add custom service");
    expect(html).toContain("Python runtime");
    expect(html).toContain("Current state");
    expect(html).toContain("Dependencies");
    expect(html).toContain("Dependents");
    expect(html).toContain("PID");
    expect(html).toContain("4100");
    expect(html).toContain("Uptime");
    expect(html).toContain("2m 5s");
    expect(html).toContain("Python runtime is ready.");
    expect(html).toContain("Provisioning");
    expect(html).toContain("3.12");
    expect(html).toContain("Repair");
    expect(html).toContain("Start workflow-execution");
    expect(html).toContain("Edit service");
    expect(html).toContain("Recent stdout/stderr and supervisor events");
    expect(html).toContain("stderr: traceback line");
  });
});
