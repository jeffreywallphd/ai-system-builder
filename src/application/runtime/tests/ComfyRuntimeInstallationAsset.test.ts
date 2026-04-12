import { describe, expect, it } from "bun:test";
import {
  ComfyRuntimeInstallationAsset,
  ComfyRuntimeInstallationAssetContractVersion,
  ComfyRuntimeInstallationAssetId,
  ComfyRuntimeInstallationAssetVersionId,
  createComfyRuntimeInstallationAsset,
  resolveComfyRuntimeInstallerRequests,
  resolveComfyRuntimeWorkingDirectory,
} from "../ComfyRuntimeInstallationAsset";

describe("ComfyRuntimeInstallationAsset", () => {
  it("defines a versioned and inspectable runtime installation asset", () => {
    expect(ComfyRuntimeInstallationAsset.assetId).toBe(ComfyRuntimeInstallationAssetId);
    expect(ComfyRuntimeInstallationAsset.versionId).toBe(ComfyRuntimeInstallationAssetVersionId);
    expect(ComfyRuntimeInstallationAsset.contractVersion).toBe(ComfyRuntimeInstallationAssetContractVersion);
    expect(ComfyRuntimeInstallationAsset.source.repositoryUri).toContain("github.com/comfyanonymous/ComfyUI");
    expect(ComfyRuntimeInstallationAsset.requiredCapabilities).toContain("comfyui-api");
    expect(ComfyRuntimeInstallationAsset.validation.requiredRepositoryPaths).toContain("requirements.txt");
    expect(ComfyRuntimeInstallationAsset.customNodeRequirements.length).toBeGreaterThan(0);
    expect(ComfyRuntimeInstallationAsset.runtimeAssetRequirements.length).toBeGreaterThan(0);
  });

  it("resolves deterministic repository installer requests from provisioned root directory", () => {
    const requests = resolveComfyRuntimeInstallerRequests({
      targetRootDirectory: "/runtime/repositories",
    });

    expect(requests.installRequest.runtimeDependencyId).toBe("runtime:comfyui");
    expect(requests.installRequest.targetRootDirectory).toBe("/runtime/repositories");
    expect(requests.installRequest.source.repositoryUri).toBe("https://github.com/comfyanonymous/ComfyUI.git");
    expect(requests.installRequest.source.requestedRevision).toBe("master");
    expect(requests.installRequest.installLocationKey).toBeUndefined();
    expect(requests.validationRequest.expectedRevision).toBe("master");
  });

  it("supports revision override and explicit install-location key pinning", () => {
    const requests = resolveComfyRuntimeInstallerRequests({
      targetRootDirectory: "/runtime/repositories",
      installLocationKey: "runtime-comfyui-shared",
      requestedRevision: {
        kind: "tag",
        value: "v0.3.0",
      },
      expectedRevision: "v0.3.0",
      includeRepositoryDiagnostics: false,
    });

    expect(requests.installRequest.installLocationKey).toBe("runtime-comfyui-shared");
    expect(requests.installRequest.source.requestedRevision).toBe("v0.3.0");
    expect(requests.updateRequest.source.requestedRevision).toBe("v0.3.0");
    expect(requests.diagnosticsRequest.includeCommandDiagnostics).toBeFalse();
  });

  it("resolves runtime working directory from install location and asset metadata", () => {
    const installDirectory = "/runtime/repositories/comfyui";
    const workingDirectory = resolveComfyRuntimeWorkingDirectory({
      installDirectory,
    });
    expect(workingDirectory).toBe(installDirectory);

    const nested = resolveComfyRuntimeWorkingDirectory({
      runtimeAsset: createComfyRuntimeInstallationAsset({
        ...ComfyRuntimeInstallationAsset,
        runtimeStart: {
          ...ComfyRuntimeInstallationAsset.runtimeStart,
          workingDirectoryRelativePath: "runtime",
        },
      }),
      installDirectory,
    });
    expect(nested).toBe("/runtime/repositories/comfyui/runtime");
  });
});
