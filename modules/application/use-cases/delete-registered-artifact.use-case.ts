import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../contracts/shared";
import type { ApplicationRequestContext } from "../ports";
import type { ArtifactCatalogDeletePort } from "../ports/artifact-catalog";
import type { ArtifactObjectStoragePort } from "../ports/storage";

export interface DeleteRegisteredArtifactCommand {
  storageKey: string;
}

export interface DeleteRegisteredArtifactUseCaseDependencies {
  artifactCatalogDelete: ArtifactCatalogDeletePort;
  storage: Pick<ArtifactObjectStoragePort, "deleteArtifact">;
}

export class DeleteRegisteredArtifactUseCase {
  private readonly artifactCatalogDelete: ArtifactCatalogDeletePort;
  private readonly storage: Pick<ArtifactObjectStoragePort, "deleteArtifact">;

  public constructor(dependencies: DeleteRegisteredArtifactUseCaseDependencies) {
    this.artifactCatalogDelete = dependencies.artifactCatalogDelete;
    this.storage = dependencies.storage;
  }

  public async execute(command: DeleteRegisteredArtifactCommand, context: ApplicationRequestContext = {}) {
    if (!command.storageKey?.trim()) {
      return createFailureResult(
        createContractError("validation", "storageKey must be a non-empty string."),
        context,
      );
    }

    const deleteCatalog = await this.artifactCatalogDelete.deleteArtifactCatalogRecord({
      storageKey: command.storageKey,
    }, context);

    if (!deleteCatalog.ok) {
      return deleteCatalog;
    }

    if (!deleteCatalog.value.deleted) {
      return createFailureResult(
        createContractError("not-found", `Artifact \"${command.storageKey}\" is not registered.`),
        context,
      );
    }

    await this.storage.deleteArtifact({ key: command.storageKey }, context);
    return createSuccessResult({ storageKey: command.storageKey }, context);
  }
}
