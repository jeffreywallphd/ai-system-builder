import path from "node:path";
import type { IModel } from "../../src/domain/models/interfaces/IModel";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import {
  ModelInstallHandle,
  ModelInstallProgress,
  ModelInstallResult,
} from "../../application/ports/ModelInstaller";
import type {
  IModelInstallHandle,
  IModelInstallProgress,
  IModelInstallRequest,
  IModelInstallResult,
  IModelInstaller,
  IModelUninstallRequest,
} from "../../application/ports/interfaces/IModelInstaller";

function buildUnsupportedInstallHandle(request: IModelInstallRequest): IModelInstallHandle {
  const result = Promise.resolve<IModelInstallResult>(new ModelInstallResult({
    model: request.model,
    destination: request.destination,
    status: "failed",
    message: "FilesystemModelInstaller only supports uninstalling managed local files.",
  }));

  return new ModelInstallHandle({
    operationId: `fs-noop-${Date.now()}`,
    request,
    initialProgress: new ModelInstallProgress({
      modelId: request.model.id,
      status: "failed",
      message: "Install is not supported by this adapter.",
    }),
    completionPromise: result,
  });
}

export class FilesystemModelInstaller implements IModelInstaller {
  constructor(private readonly fileStorage: IFileStorage) {}

  public async startInstall(request: IModelInstallRequest): Promise<IModelInstallHandle> {
    return buildUnsupportedInstallHandle(request);
  }

  public async install(
    request: IModelInstallRequest,
    onProgress?: (progress: IModelInstallProgress) => void,
  ): Promise<IModelInstallResult> {
    onProgress?.(new ModelInstallProgress({
      modelId: request.model.id,
      status: "failed",
      message: "FilesystemModelInstaller only supports uninstalling managed local files.",
    }));

    return new ModelInstallResult({
      model: request.model,
      destination: request.destination,
      status: "failed",
      message: "FilesystemModelInstaller only supports uninstalling managed local files.",
    });
  }

  public canInstall(): boolean {
    return false;
  }

  public async isInstalled(model: IModel, destination?: string): Promise<boolean> {
    const location = destination?.trim() || model.artifact.location?.trim();
    return !!location && this.fileStorage.exists(location);
  }

  public async uninstall(request: IModelUninstallRequest): Promise<void> {
    const artifactLocations = collectArtifactLocations(request.model);

    if (!request.removeArtifacts) {
      return;
    }

    const uniqueLocations = [...new Set(artifactLocations)].sort((left, right) => right.length - left.length);
    for (const location of uniqueLocations) {
      if (await this.fileStorage.exists(location)) {
        await this.fileStorage.delete(location);
      }
      await deleteEmptyParents(this.fileStorage, path.dirname(location));
    }
  }

  public canUninstall(model: IModel): boolean {
    const artifactLocations = collectArtifactLocations(model);
    return artifactLocations.length > 0;
  }
}

function collectArtifactLocations(model: IModel): string[] {
  return [model.artifact, ...model.additionalArtifacts]
    .map((artifact) => artifact.location?.trim())
    .filter((value): value is string => !!value);
}

async function deleteEmptyParents(fileStorage: IFileStorage, startDirectory: string): Promise<void> {
  let current = startDirectory;

  while (current && current !== "." && current !== path.dirname(current)) {
    const entries = await fileStorage.list(current).catch(() => []);
    if (entries.length > 0) {
      return;
    }

    if (await fileStorage.exists(current).catch(() => false)) {
      await fileStorage.delete(current).catch(() => undefined);
    }

    current = path.dirname(current);
  }
}
