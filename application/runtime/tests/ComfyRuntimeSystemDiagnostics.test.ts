import { describe, expect, it } from "bun:test";
import {
  ComfyRuntimeLifecycleStates,
  type ComfyRuntimeLifecycleResult,
} from "../ComfyRuntimeLifecycleContract";
import {
  ComfyRuntimeOrchestrationStates,
  type ComfyRuntimeInstallerOrchestrationResult,
} from "../ComfyRuntimeInstallerOrchestrationService";
import {
  ComfyRuntimeSystemDiagnosticsVersion,
  ComfyRuntimeSystemReadinessStates,
  createComfyRuntimeSystemDiagnosticsFromOrchestration,
  createComfyRuntimeSystemDiagnosticsFromPersistedState,
  readComfyRuntimeSystemDiagnostics,
} from "../ComfyRuntimeSystemDiagnostics";

describe("ComfyRuntimeSystemDiagnostics", () => {
  it("classifies fully completed orchestration as ready", () => {
    const diagnostics = createComfyRuntimeSystemDiagnosticsFromOrchestration(createResult({
      state: ComfyRuntimeOrchestrationStates.ready,
      phases: [
        phase("environment", "completed"),
        phase("dependencies", "completed"),
        phase("custom-nodes", "completed"),
        phase("model-validation", "completed"),
        phase("runtime-validation", "completed", {
          runtimeLifecycle: lifecycle(ComfyRuntimeLifecycleStates.healthy),
        }),
      ],
      issues: [],
    }));

    expect(diagnostics.readiness.state).toBe(ComfyRuntimeSystemReadinessStates.ready);
    expect(diagnostics.validationFailures).toHaveLength(0);
    expect(diagnostics.nextActions).toHaveLength(0);
  });

  it("classifies missing dependency/model failures and emits remediation actions", () => {
    const diagnostics = createComfyRuntimeSystemDiagnosticsFromOrchestration(createResult({
      state: ComfyRuntimeOrchestrationStates.failed,
      phases: [
        phase("environment", "completed"),
        phase("dependencies", "failed"),
        phase("model-validation", "failed"),
        phase("runtime-validation", "skipped"),
      ],
      issues: [
        issue("dependency-install-failed", "error", "Dependency install failed.", "dependencies"),
        issue("runtime-asset-missing", "error", "Required checkpoint missing.", "model-validation"),
      ],
    }));

    expect(diagnostics.readiness.state).toBe(ComfyRuntimeSystemReadinessStates.missingDependenciesOrAssets);
    expect(diagnostics.validationFailures.map((entry) => entry.code)).toContain("runtime-asset-missing");
    expect(diagnostics.nextActions.map((entry) => entry.code)).toContain("install-python-dependencies");
    expect(diagnostics.nextActions.map((entry) => entry.code)).toContain("install-required-runtime-assets");
  });

  it("classifies unhealthy runtime when lifecycle validation fails", () => {
    const diagnostics = createComfyRuntimeSystemDiagnosticsFromOrchestration(createResult({
      state: ComfyRuntimeOrchestrationStates.failed,
      phases: [
        phase("environment", "completed"),
        phase("dependencies", "completed"),
        phase("model-validation", "completed"),
        phase("runtime-validation", "failed", {
          runtimeLifecycle: lifecycle(ComfyRuntimeLifecycleStates.timedOut),
        }),
      ],
      issues: [
        issue("runtime-validation-timeout", "error", "Runtime did not become healthy.", "runtime-validation"),
      ],
    }));

    expect(diagnostics.readiness.state).toBe(ComfyRuntimeSystemReadinessStates.unhealthy);
    expect(diagnostics.runtimeLifecycle.state).toBe(ComfyRuntimeLifecycleStates.timedOut);
    expect(diagnostics.nextActions.map((entry) => entry.code)).toContain("restore-runtime-health");
  });

  it("hydrates diagnostics from persisted state and preserves recovery details", () => {
    const diagnostics = createComfyRuntimeSystemDiagnosticsFromPersistedState({
      schemaVersion: 1,
      runtimeDependencyId: "runtime:comfyui",
      runtimeAssetId: "asset:config-profile:comfyui-runtime-installation",
      runtimeAssetVersionId: "asset:config-profile:comfyui-runtime-installation:v1",
      installLocationKey: "runtime-comfyui",
      installDirectory: "/runtime/comfy",
      runtimeWorkingDirectory: "/runtime/comfy",
      runtimeEndpoint: "http://127.0.0.1:8188",
      repositoryState: "installed",
      repositoryRevision: "abc123",
      orchestrationState: "partial",
      phases: {
        environment: {
          status: "completed",
          updatedAt: "2026-04-03T10:00:00.000Z",
          message: "Environment ready.",
          metadata: {},
          issues: [],
        },
      },
      lastLifecycle: lifecycle(ComfyRuntimeLifecycleStates.healthy),
      issues: [],
      diagnostics: {
        statePath: "/runtime/comfy/.ai-loom-comfy-installer-state.json",
      },
      startedAt: "2026-04-03T10:00:00.000Z",
      updatedAt: "2026-04-03T10:10:00.000Z",
      completedAt: "2026-04-03T10:10:00.000Z",
    });

    expect(diagnostics.persistedStateRecovery.loaded).toBeTrue();
    expect(diagnostics.persistedStateRecovery.statePath).toContain(".ai-loom-comfy-installer-state.json");
    expect(diagnostics.orchestrationState).toBe("partial");
  });

  it("parses only valid runtime diagnostics payloads", () => {
    const valid = readComfyRuntimeSystemDiagnostics({
      diagnosticsVersion: ComfyRuntimeSystemDiagnosticsVersion,
      runtimeDependencyId: "runtime:comfyui",
      runtimeAssetId: "asset:config-profile:comfyui-runtime-installation",
      runtimeAssetVersionId: "asset:config-profile:comfyui-runtime-installation:v1",
      readiness: {
        state: "ready",
      },
    });
    const invalid = readComfyRuntimeSystemDiagnostics({
      diagnosticsVersion: "invalid",
    });

    expect(valid).toBeDefined();
    expect(invalid).toBeUndefined();
  });
});

function createResult(input: {
  readonly state: "ready" | "partial" | "failed";
  readonly phases: ReadonlyArray<Omit<ComfyRuntimeInstallerOrchestrationResult, "systemDiagnostics">["phases"][number]>;
  readonly issues: ReadonlyArray<Omit<ComfyRuntimeInstallerOrchestrationResult, "systemDiagnostics">["issues"][number]>;
}): Omit<ComfyRuntimeInstallerOrchestrationResult, "systemDiagnostics"> {
  return {
    state: input.state,
    runtimeAsset: {
      assetId: "asset:config-profile:comfyui-runtime-installation",
      versionId: "asset:config-profile:comfyui-runtime-installation:v1",
      runtimeDependencyId: "runtime:comfyui",
    } as ComfyRuntimeInstallerOrchestrationResult["runtimeAsset"],
    resolvedTargets: {
      targetRootDirectory: "/runtime",
      installDirectory: "/runtime/comfy",
      runtimeWorkingDirectory: "/runtime/comfy",
      runtimeEndpoint: "http://127.0.0.1:8188",
      installLocationKey: "runtime-comfyui",
      workflowProfile: "image-manipulation-default",
    },
    repository: {
      operation: "updated",
      statusBefore: {
        state: "installed",
        installLocation: {
          installLocationKey: "runtime-comfyui",
          installDirectory: "/runtime/comfy",
          targetRootDirectory: "/runtime",
        },
        issues: [],
      },
      statusAfter: {
        state: "installed",
        installLocation: {
          installLocationKey: "runtime-comfyui",
          installDirectory: "/runtime/comfy",
          targetRootDirectory: "/runtime",
        },
        installed: {
          runtimeDependencyId: "runtime:comfyui",
          installerKind: "git",
          source: {
            repositoryKind: "git",
            repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
            requestedRevision: "master",
            metadata: {},
          },
          installLocation: {
            installLocationKey: "runtime-comfyui",
            installDirectory: "/runtime/comfy",
            targetRootDirectory: "/runtime",
          },
          resolvedRevision: "abc123",
          installedAt: "2026-04-03T10:00:00.000Z",
          updatedAt: "2026-04-03T10:00:00.000Z",
          metadata: {},
        },
        issues: [],
      },
      validation: {
        valid: true,
        status: {
          state: "installed",
          installLocation: {
            installLocationKey: "runtime-comfyui",
            installDirectory: "/runtime/comfy",
            targetRootDirectory: "/runtime",
          },
          issues: [],
        },
        issues: [],
      },
      diagnostics: {
        status: {
          state: "installed",
          installLocation: {
            installLocationKey: "runtime-comfyui",
            installDirectory: "/runtime/comfy",
            targetRootDirectory: "/runtime",
          },
          issues: [],
        },
        commandDiagnostics: [],
        issues: [],
      },
    },
    phases: input.phases,
    issues: input.issues,
    persistedState: {
      loaded: true,
      recovered: false,
      reconciliation: "match",
      statePath: "/runtime/comfy/.ai-loom-comfy-installer-state.json",
    },
  };
}

function phase(
  phaseName: "environment" | "dependencies" | "custom-nodes" | "model-validation" | "runtime-validation",
  status: "completed" | "failed" | "skipped" | "not-implemented",
  metadata?: Readonly<Record<string, unknown>>,
): ComfyRuntimeInstallerOrchestrationResult["phases"][number] {
  return Object.freeze({
    phase: phaseName,
    status,
    message: `${phaseName}:${status}`,
    startedAt: "2026-04-03T10:00:00.000Z",
    finishedAt: "2026-04-03T10:00:01.000Z",
    issues: [],
    metadata,
  });
}

function issue(
  code: string,
  severity: "error" | "warning",
  message: string,
  phaseName: string,
): ComfyRuntimeInstallerOrchestrationResult["issues"][number] {
  return Object.freeze({
    code,
    severity,
    message,
    phase: phaseName,
  });
}

function lifecycle(state: ComfyRuntimeLifecycleResult["state"]): ComfyRuntimeLifecycleResult {
  return Object.freeze({
    operation: "validate",
    state,
    endpointValidation: {
      endpoint: "http://127.0.0.1:8188",
      readinessUrl: "http://127.0.0.1:8188/system_stats",
      livenessUrl: "http://127.0.0.1:8188/queue",
      valid: true,
      diagnostics: [],
    },
    process: {
      started: false,
      alreadyRunning: false,
      stopped: false,
      gracefulStop: false,
      forcedStop: false,
    },
    health: {
      endpoint: "http://127.0.0.1:8188",
      readinessUrl: "http://127.0.0.1:8188/system_stats",
      livenessUrl: "http://127.0.0.1:8188/queue",
      healthy: state === "healthy",
      checkedAt: "2026-04-03T10:00:01.000Z",
      durationMs: 12,
      readinessStatusCode: state === "healthy" ? 200 : undefined,
      livenessStatusCode: state === "healthy" ? 200 : undefined,
    },
    startedAt: "2026-04-03T10:00:00.000Z",
    finishedAt: "2026-04-03T10:00:01.000Z",
    durationMs: 10,
    diagnostics: [],
    metadata: {},
  });
}
