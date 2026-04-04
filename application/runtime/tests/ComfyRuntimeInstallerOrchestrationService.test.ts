import { describe, expect, it } from "bun:test";
import {
  RuntimeRepositoryInstallationStates,
  type IRuntimeRepositoryInstallerContract,
  type RuntimeRepositoryDiagnosticsRequest,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryInstallLocationRequest,
  type RuntimeRepositoryInstallLocation,
  type RuntimeRepositoryInstallRequest,
  type RuntimeRepositoryInstallResult,
  type RuntimeRepositoryStatusRequest,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryUpdateRequest,
  type RuntimeRepositoryUpdateResult,
  type RuntimeRepositoryValidationRequest,
  type RuntimeRepositoryValidationResult,
} from "../RuntimeRepositoryInstallerContract";
import {
  ComfyRuntimeInstallationAsset,
} from "../ComfyRuntimeInstallationAsset";
import {
  ComfyRuntimeInstallerOrchestrationService,
  ComfyRuntimeOrchestrationPhaseStatuses,
  ComfyRuntimeOrchestrationStates,
} from "../ComfyRuntimeInstallerOrchestrationService";

describe("ComfyRuntimeInstallerOrchestrationService", () => {
  it("installs repository and reports partial when later phases are not implemented", async () => {
    const installer = new FakeRuntimeRepositoryInstaller(RuntimeRepositoryInstallationStates.notInstalled);
    const service = new ComfyRuntimeInstallerOrchestrationService(installer, {
      now: () => new Date("2026-04-03T20:00:00.000Z"),
    });

    const result = await service.orchestrate({
      targetRootDirectory: "/runtime/repositories",
    });

    expect(result.state).toBe(ComfyRuntimeOrchestrationStates.partial);
    expect(result.repository.operation).toBe("installed");
    expect(result.repository.installResult?.success).toBeTrue();
    expect(result.resolvedTargets.installDirectory).toContain("runtime-repositories");
    expect(result.phases[0]?.phase).toBe("repository");
    expect(result.phases[0]?.status).toBe(ComfyRuntimeOrchestrationPhaseStatuses.completed);
    expect(result.phases.slice(1).every((entry) => entry.status === ComfyRuntimeOrchestrationPhaseStatuses.notImplemented)).toBeTrue();
    expect(result.issues.some((entry) => entry.code === "dependency-install-not-implemented")).toBeTrue();
  });

  it("updates an existing install and reaches ready when hooks complete", async () => {
    const installer = new FakeRuntimeRepositoryInstaller(RuntimeRepositoryInstallationStates.installed);
    const service = new ComfyRuntimeInstallerOrchestrationService(installer, {
      environmentPreparationHook: {
        prepare: async () => ({ status: "completed", message: "Environment prepared." }),
      },
      dependencyInstallationHook: {
        installDependencies: async () => ({ status: "completed", message: "Dependencies installed." }),
      },
      customNodeInstallationHook: {
        installCustomNodes: async () => ({ status: "skipped", message: "No custom nodes requested." }),
      },
      modelValidationHook: {
        validateModels: async () => ({ status: "completed", message: "Model check passed." }),
      },
      runtimeValidationHook: {
        validateRuntime: async () => ({ status: "completed", message: "Runtime health check passed." }),
      },
      now: () => new Date("2026-04-03T20:00:00.000Z"),
    });

    const result = await service.orchestrate({
      targetRootDirectory: "/runtime/repositories",
      updateMode: "install-or-update",
    });

    expect(result.state).toBe(ComfyRuntimeOrchestrationStates.ready);
    expect(result.repository.operation).toBe("updated");
    expect(result.phases.find((entry) => entry.phase === "dependencies")?.status).toBe("completed");
    expect(result.phases.find((entry) => entry.phase === "custom-nodes")?.status).toBe("skipped");
    expect(result.issues.some((entry) => entry.severity === "error")).toBeFalse();
  });

  it("fails fast when repository install fails and skips later phases", async () => {
    const installer = new FakeRuntimeRepositoryInstaller(RuntimeRepositoryInstallationStates.notInstalled, {
      failInstall: true,
    });
    const service = new ComfyRuntimeInstallerOrchestrationService(installer, {
      now: () => new Date("2026-04-03T20:00:00.000Z"),
    });

    const result = await service.orchestrate({
      targetRootDirectory: "/runtime/repositories",
    });

    expect(result.state).toBe(ComfyRuntimeOrchestrationStates.failed);
    expect(result.phases[0]?.status).toBe(ComfyRuntimeOrchestrationPhaseStatuses.failed);
    expect(result.phases.slice(1).every((entry) => entry.status === ComfyRuntimeOrchestrationPhaseStatuses.skipped)).toBeTrue();
    expect(result.issues.map((entry) => entry.code)).toContain("repository-install-failed");
  });

  it("accepts a custom runtime asset and carries metadata through resolved targets", async () => {
    const installer = new FakeRuntimeRepositoryInstaller(RuntimeRepositoryInstallationStates.installed);
    const service = new ComfyRuntimeInstallerOrchestrationService(installer, {
      environmentPreparationHook: {
        prepare: async () => ({ status: "completed", message: "ok" }),
      },
      dependencyInstallationHook: {
        installDependencies: async () => ({ status: "completed", message: "ok" }),
      },
      customNodeInstallationHook: {
        installCustomNodes: async () => ({ status: "completed", message: "ok" }),
      },
      modelValidationHook: {
        validateModels: async () => ({ status: "completed", message: "ok" }),
      },
      runtimeValidationHook: {
        validateRuntime: async () => ({ status: "completed", message: "ok" }),
      },
    });

    const customAsset = {
      ...ComfyRuntimeInstallationAsset,
      source: {
        ...ComfyRuntimeInstallationAsset.source,
        revisionPinning: {
          ...ComfyRuntimeInstallationAsset.source.revisionPinning,
          defaultValue: "release-1",
        },
      },
    };

    const result = await service.orchestrate({
      runtimeAsset: customAsset,
      targetRootDirectory: "/runtime/repositories",
    });

    expect(result.runtimeAsset.source.revisionPinning.defaultValue).toBe("release-1");
    expect(result.resolvedTargets.runtimeEndpoint).toBe("http://127.0.0.1:8188");
    expect(result.repository.statusAfter.installed?.source.requestedRevision).toBe("release-1");
  });

  it("surfaces structured model-validation output through orchestration phase metadata", async () => {
    const installer = new FakeRuntimeRepositoryInstaller(RuntimeRepositoryInstallationStates.installed);
    const service = new ComfyRuntimeInstallerOrchestrationService(installer, {
      environmentPreparationHook: {
        prepare: async () => ({ status: "completed", message: "ok" }),
      },
      dependencyInstallationHook: {
        installDependencies: async () => ({ status: "completed", message: "ok" }),
      },
      customNodeInstallationHook: {
        installCustomNodes: async () => ({ status: "completed", message: "ok" }),
      },
      modelValidationHook: {
        validateModels: async () => ({
          status: "failed",
          message: "Model validation failed.",
          issues: [{
            code: "missing-required",
            severity: "error",
            message: "Required checkpoint missing.",
            phase: "model-validation",
          }],
          metadata: {
            modelValidation: {
              summary: {
                total: 1,
                presentValid: 0,
                missingRequired: 1,
                missingOptional: 0,
                incompatible: 0,
                unknownUnverifiable: 0,
              },
            },
          },
        }),
      },
      runtimeValidationHook: {
        validateRuntime: async () => ({ status: "skipped", message: "runtime skipped" }),
      },
      now: () => new Date("2026-04-03T20:00:00.000Z"),
    });

    const result = await service.orchestrate({
      targetRootDirectory: "/runtime/repositories",
      workflowProfile: "image-manipulation-default",
    });

    expect(result.state).toBe(ComfyRuntimeOrchestrationStates.failed);
    const modelPhase = result.phases.find((entry) => entry.phase === "model-validation");
    expect(modelPhase?.status).toBe("failed");
    expect((modelPhase?.metadata as { modelValidation?: { summary?: { missingRequired: number } } } | undefined)
      ?.modelValidation?.summary?.missingRequired).toBe(1);
    expect(result.issues.some((entry) => entry.code === "missing-required")).toBeTrue();
  });
});

class FakeRuntimeRepositoryInstaller implements IRuntimeRepositoryInstallerContract {
  private readonly installLocation: RuntimeRepositoryInstallLocation = Object.freeze({
    installLocationKey: "runtime-comfyui-install",
    installDirectory: "/runtime/repositories/runtime-comfyui-install",
    targetRootDirectory: "/runtime/repositories",
  });
  private statusState: RuntimeRepositoryStatusResult["state"];
  private readonly options: {
    readonly failInstall?: boolean;
  };

  public constructor(
    initialStatus: RuntimeRepositoryStatusResult["state"],
    options: { readonly failInstall?: boolean } = {},
  ) {
    this.statusState = initialStatus;
    this.options = options;
  }

  public resolveInstallLocation(_request: RuntimeRepositoryInstallLocationRequest): RuntimeRepositoryInstallLocation {
    return this.installLocation;
  }

  public async install(request: RuntimeRepositoryInstallRequest): Promise<RuntimeRepositoryInstallResult> {
    if (this.options.failInstall) {
      return Object.freeze({
        success: false,
        operation: "failed",
        recoveredFromPartial: false,
        issues: Object.freeze([]),
        error: {
          code: "install-failed",
          message: "install failed",
          retryable: false,
          metadata: {},
        },
      });
    }
    this.statusState = RuntimeRepositoryInstallationStates.installed;
    return Object.freeze({
      success: true,
      operation: "installed",
      recoveredFromPartial: false,
      issues: Object.freeze([]),
      installed: this.createInstalledMetadata(request.source.requestedRevision ?? "master"),
    });
  }

  public async update(request: RuntimeRepositoryUpdateRequest): Promise<RuntimeRepositoryUpdateResult> {
    this.statusState = RuntimeRepositoryInstallationStates.installed;
    return Object.freeze({
      success: true,
      operation: "updated",
      updated: true,
      beforeRevision: "a1",
      afterRevision: "b2",
      issues: Object.freeze([]),
      installed: this.createInstalledMetadata(request.source.requestedRevision ?? "master"),
    });
  }

  public async inspectStatus(_request: RuntimeRepositoryStatusRequest): Promise<RuntimeRepositoryStatusResult> {
    return Object.freeze({
      state: this.statusState,
      installLocation: this.installLocation,
      issues: Object.freeze([]),
      installed: this.statusState === RuntimeRepositoryInstallationStates.installed
        ? this.createInstalledMetadata("master")
        : undefined,
    });
  }

  public async validate(_request: RuntimeRepositoryValidationRequest): Promise<RuntimeRepositoryValidationResult> {
    return Object.freeze({
      valid: this.statusState === RuntimeRepositoryInstallationStates.installed,
      status: await this.inspectStatus(this.createStatusRequest()),
      issues: Object.freeze([]),
    });
  }

  public async collectDiagnostics(_request: RuntimeRepositoryDiagnosticsRequest): Promise<RuntimeRepositoryDiagnosticsResult> {
    return Object.freeze({
      status: await this.inspectStatus(this.createStatusRequest()),
      commandDiagnostics: Object.freeze([]),
      issues: Object.freeze([]),
    });
  }

  private createInstalledMetadata(requestedRevision: string) {
    return Object.freeze({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: "git",
      source: Object.freeze({
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision,
        metadata: Object.freeze({}),
      }),
      installLocation: this.installLocation,
      resolvedRevision: "deadbeef",
      installedAt: "2026-04-03T20:00:00.000Z",
      updatedAt: "2026-04-03T20:00:00.000Z",
      metadata: Object.freeze({}),
    });
  }

  private createStatusRequest(): RuntimeRepositoryStatusRequest {
    return Object.freeze({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: "git",
      source: Object.freeze({
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: Object.freeze({}),
      }),
      targetRootDirectory: this.installLocation.targetRootDirectory,
    });
  }
}
