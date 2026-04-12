import { describe, expect, it } from "bun:test";
import {
  RuntimeRepositoryInstallerKinds,
  createRuntimeRepositoryInstallLocationKey,
  createRuntimeRepositoryInstallRequest,
  createRuntimeRepositoryStatusRequest,
} from "../RuntimeRepositoryInstallerContract";

describe("RuntimeRepositoryInstallerContract", () => {
  it("normalizes install requests and freezes nested metadata", () => {
    const request = createRuntimeRepositoryInstallRequest({
      runtimeDependencyId: " runtime:comfyui ",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: " git ",
        repositoryUri: " https://github.com/example/runtime.git ",
        requestedRevision: " main ",
        metadata: {
          provider: "github",
        },
      },
      targetRootDirectory: " /var/runtime-repos ",
      metadata: {
        shared: true,
      },
    });

    expect(request.runtimeDependencyId).toBe("runtime:comfyui");
    expect(request.source.repositoryKind).toBe("git");
    expect(request.source.repositoryUri).toBe("https://github.com/example/runtime.git");
    expect(request.source.requestedRevision).toBe("main");
    expect(request.targetRootDirectory).toBe("/var/runtime-repos");
    expect(Object.isFrozen(request.source.metadata)).toBeTrue();
    expect(Object.isFrozen(request.metadata)).toBeTrue();
  });

  it("builds deterministic install location keys from dependency+source identity", () => {
    const first = createRuntimeRepositoryInstallLocationKey({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: RuntimeRepositoryInstallerKinds.git,
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "main",
      },
    });
    const second = createRuntimeRepositoryInstallLocationKey({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: RuntimeRepositoryInstallerKinds.git,
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "main",
      },
    });
    const differentRevision = createRuntimeRepositoryInstallLocationKey({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: RuntimeRepositoryInstallerKinds.git,
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "v1.0.0",
      },
    });

    expect(first).toBe(second);
    expect(differentRevision).not.toBe(first);
  });

  it("supports status requests for any repository/runtime kind without ComfyUI coupling", () => {
    const statusRequest = createRuntimeRepositoryStatusRequest({
      runtimeDependencyId: "runtime:generic-document-service",
      installerKind: "archive",
      source: {
        repositoryKind: "archive",
        repositoryUri: "https://example.org/document-runtime.tar.gz",
      },
      targetRootDirectory: "/var/runtime-repos",
    });

    expect(statusRequest.installerKind).toBe("archive");
    expect(statusRequest.source.repositoryKind).toBe("archive");
  });
});
