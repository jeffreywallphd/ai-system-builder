import { describe, expect, it } from "bun:test";
import {
  RuntimeRepositoryInstallationStates,
  type IRuntimeRepositoryInstallerContract,
  type RuntimeRepositoryDiagnosticsRequest,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryInstallLocation,
  type RuntimeRepositoryInstallLocationRequest,
  type RuntimeRepositoryInstallRequest,
  type RuntimeRepositoryInstallResult,
  type RuntimeRepositoryStatusRequest,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryUpdateRequest,
  type RuntimeRepositoryUpdateResult,
  type RuntimeRepositoryValidationRequest,
  type RuntimeRepositoryValidationResult,
} from "../../../application/runtime/RuntimeRepositoryInstallerContract";
import { ComfyRuntimeInstallationAsset } from "../../../application/runtime/ComfyRuntimeInstallationAsset";
import { ComfyRuntimeWorkflowProfiles } from "../../../application/runtime/ComfyRuntimeRequirements";
import type { ComfyRuntimeOrchestrationContext } from "../../../application/runtime/ComfyRuntimeInstallerOrchestrationService";
import { ComfyRuntimeCustomNodeInstallationHooks } from "../ComfyRuntimeCustomNodeInstallationHooks";

describe("ComfyRuntimeCustomNodeInstallationHooks", () => {
  it("installs required FaceID custom nodes and reports normalized diagnostics", async () => {
    const installer = new FakeRuntimeRepositoryInstaller();
    const hooks = new ComfyRuntimeCustomNodeInstallationHooks(installer);

    const result = await hooks.installCustomNodes(createContext(ComfyRuntimeWorkflowProfiles.imageManipulationFaceId));

    expect(result.status).toBe("completed");
    const metadata = result.metadata?.customNodeInstall as {
      total: number;
      installedCount: number;
      entries: ReadonlyArray<{ requirementId: string; status: string }>;
    };
    expect(metadata.total).toBeGreaterThanOrEqual(2);
    expect(metadata.installedCount).toBeGreaterThanOrEqual(2);
    expect(metadata.entries.every((entry) => entry.status === "installed" || entry.status === "already-installed")).toBeTrue();
  });

  it("supports safe re-entry recovery after a partial install", async () => {
    const installer = new FakeRuntimeRepositoryInstaller({
      initialStateById: {
        "runtime:comfyui:custom-node:comfyui-ipadapter-plus": RuntimeRepositoryInstallationStates.partiallyInstalled,
      },
    });
    const hooks = new ComfyRuntimeCustomNodeInstallationHooks(installer);

    const result = await hooks.installCustomNodes(createContext(ComfyRuntimeWorkflowProfiles.imageManipulationFaceId));
    const metadata = result.metadata?.customNodeInstall as {
      entries: ReadonlyArray<{ requirementId: string; recoveredFromPartial?: boolean }>;
    };
    const ipAdapter = metadata.entries.find((entry) => entry.requirementId === "comfyui-ipadapter-plus");
    expect(ipAdapter?.recoveredFromPartial).toBeTrue();
  });

  it("returns failures with normalized issue diagnostics", async () => {
    const installer = new FakeRuntimeRepositoryInstaller({
      failInstallForDependencyIds: ["runtime:comfyui:custom-node:comfyui-instantid"],
    });
    const hooks = new ComfyRuntimeCustomNodeInstallationHooks(installer);

    const result = await hooks.installCustomNodes(createContext(ComfyRuntimeWorkflowProfiles.imageManipulationFaceId));
    expect(result.status).toBe("failed");
    expect(result.issues?.some((entry) => entry.code === "custom-node-install-failed")).toBeTrue();
  });
});

class FakeRuntimeRepositoryInstaller implements IRuntimeRepositoryInstallerContract {
  private readonly installLocationByDependencyId = new Map<string, RuntimeRepositoryInstallLocation>();
  private readonly stateByDependencyId = new Map<string, RuntimeRepositoryStatusResult["state"]>();
  private readonly failInstallForDependencyIds: ReadonlySet<string>;

  public constructor(options: {
    readonly initialStateById?: Readonly<Record<string, RuntimeRepositoryStatusResult["state"]>>;
    readonly failInstallForDependencyIds?: ReadonlyArray<string>;
  } = {}) {
    for (const [dependencyId, state] of Object.entries(options.initialStateById ?? {})) {
      this.stateByDependencyId.set(dependencyId, state);
    }
    this.failInstallForDependencyIds = new Set(options.failInstallForDependencyIds ?? []);
  }

  public resolveInstallLocation(request: RuntimeRepositoryInstallLocationRequest): RuntimeRepositoryInstallLocation {
    return this.getInstallLocation(request.runtimeDependencyId, request.targetRootDirectory);
  }

  public async install(request: RuntimeRepositoryInstallRequest): Promise<RuntimeRepositoryInstallResult> {
    if (this.failInstallForDependencyIds.has(request.runtimeDependencyId)) {
      return Object.freeze({
        success: false,
        operation: "failed",
        recoveredFromPartial: false,
        issues: Object.freeze([]),
        error: Object.freeze({
          code: "install-failed",
          message: "install failed",
          retryable: false,
          metadata: Object.freeze({}),
        }),
      });
    }
    const previous = this.stateByDependencyId.get(request.runtimeDependencyId);
    this.stateByDependencyId.set(request.runtimeDependencyId, RuntimeRepositoryInstallationStates.installed);
    return Object.freeze({
      success: true,
      operation: "installed",
      recoveredFromPartial: previous === RuntimeRepositoryInstallationStates.partiallyInstalled,
      issues: Object.freeze([]),
      installed: this.createInstalledMetadata(request.runtimeDependencyId, request.targetRootDirectory, request.source.requestedRevision ?? "main"),
    });
  }

  public async update(request: RuntimeRepositoryUpdateRequest): Promise<RuntimeRepositoryUpdateResult> {
    this.stateByDependencyId.set(request.runtimeDependencyId, RuntimeRepositoryInstallationStates.installed);
    return Object.freeze({
      success: true,
      operation: "already-current",
      updated: false,
      beforeRevision: "rev1",
      afterRevision: "rev1",
      issues: Object.freeze([]),
      installed: this.createInstalledMetadata(request.runtimeDependencyId, request.targetRootDirectory, request.source.requestedRevision ?? "main"),
    });
  }

  public async inspectStatus(request: RuntimeRepositoryStatusRequest): Promise<RuntimeRepositoryStatusResult> {
    const state = this.stateByDependencyId.get(request.runtimeDependencyId) ?? RuntimeRepositoryInstallationStates.notInstalled;
    const installLocation = this.getInstallLocation(request.runtimeDependencyId, request.targetRootDirectory);
    return Object.freeze({
      state,
      installLocation,
      issues: Object.freeze([]),
      installed: state === RuntimeRepositoryInstallationStates.installed
        ? this.createInstalledMetadata(request.runtimeDependencyId, request.targetRootDirectory, request.source.requestedRevision ?? "main")
        : undefined,
    });
  }

  public async validate(request: RuntimeRepositoryValidationRequest): Promise<RuntimeRepositoryValidationResult> {
    const status = await this.inspectStatus(request);
    return Object.freeze({
      valid: status.state === RuntimeRepositoryInstallationStates.installed,
      status,
      issues: Object.freeze([]),
    });
  }

  public async collectDiagnostics(request: RuntimeRepositoryDiagnosticsRequest): Promise<RuntimeRepositoryDiagnosticsResult> {
    return Object.freeze({
      status: await this.inspectStatus(request),
      commandDiagnostics: Object.freeze([]),
      issues: Object.freeze([]),
    });
  }

  private getInstallLocation(runtimeDependencyId: string, targetRootDirectory: string): RuntimeRepositoryInstallLocation {
    const existing = this.installLocationByDependencyId.get(runtimeDependencyId);
    if (existing) {
      return existing;
    }
    const normalized = runtimeDependencyId.replace(/[^a-z0-9._-]+/gi, "-");
    const location = Object.freeze({
      installLocationKey: normalized,
      installDirectory: `${targetRootDirectory}/${normalized}`,
      targetRootDirectory,
    });
    this.installLocationByDependencyId.set(runtimeDependencyId, location);
    return location;
  }

  private createInstalledMetadata(runtimeDependencyId: string, targetRootDirectory: string, revision: string) {
    const installLocation = this.getInstallLocation(runtimeDependencyId, targetRootDirectory);
    return Object.freeze({
      runtimeDependencyId,
      installerKind: "git",
      source: Object.freeze({
        repositoryKind: "git",
        repositoryUri: "https://example.com/repository.git",
        requestedRevision: revision,
        metadata: Object.freeze({}),
      }),
      installLocation,
      resolvedRevision: "deadbeef",
      installedAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      metadata: Object.freeze({}),
    });
  }
}

function createContext(workflowProfile: (typeof ComfyRuntimeWorkflowProfiles)[keyof typeof ComfyRuntimeWorkflowProfiles]): ComfyRuntimeOrchestrationContext {
  return Object.freeze({
    runtimeAsset: ComfyRuntimeInstallationAsset,
    installDirectory: "/runtime/comfyui",
    runtimeWorkingDirectory: "/runtime/comfyui",
    runtimeEndpoint: "http://127.0.0.1:8188",
    workflowProfile,
  });
}

