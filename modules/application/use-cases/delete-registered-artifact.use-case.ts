import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../contracts/shared";
import type { ApplicationRequestContext } from "../ports";
import type { ArtifactCatalogDeletePort, ArtifactCatalogReadPort } from "../ports/artifact-catalog";
import type { ArtifactObjectStoragePort, ArtifactStorageBindingPort } from "../ports/storage";

export interface DeleteRegisteredArtifactCommand {
  storageKey: string;
}

export interface DeleteRegisteredArtifactUseCaseDependencies {
  artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord">;
  artifactCatalogDelete: ArtifactCatalogDeletePort;
  storage: Pick<ArtifactObjectStoragePort, "deleteArtifact">;
  artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings">;
}

export class DeleteRegisteredArtifactUseCase {
  private readonly artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord">;
  private readonly artifactCatalogDelete: ArtifactCatalogDeletePort;
  private readonly storage: Pick<ArtifactObjectStoragePort, "deleteArtifact">;
  private readonly artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings">;

  public constructor(dependencies: DeleteRegisteredArtifactUseCaseDependencies) {
    this.artifactCatalogRead = dependencies.artifactCatalogRead;
    this.artifactCatalogDelete = dependencies.artifactCatalogDelete;
    this.storage = dependencies.storage;
    this.artifactBindingStorage = dependencies.artifactBindingStorage;
  }

  public async execute(command: DeleteRegisteredArtifactCommand, context: ApplicationRequestContext = {}) {
    if (!command.storageKey?.trim()) {
      return createFailureResult(
        createContractError("validation", "storageKey must be a non-empty string."),
        context,
      );
    }

    const storageKey = command.storageKey.trim();

    // Semantics for registered deletion:
    // 1. Confirm registration exists.
    // 2. Remove local object-state and local backing bindings.
    // 3. Remove registration record only after local cleanup succeeds.
    // Remote provider assets are never deleted by this flow.
    const readCatalog = await this.artifactCatalogRead.readArtifactCatalogRecord({
      storageKey,
    }, context);

    if (!readCatalog.ok) {
      if (readCatalog.error.code === "not-found") {
        return createFailureResult(
          createContractError("not-found", `Artifact \"${storageKey}\" is not registered.`),
          context,
        );
      }
      return readCatalog;
    }

    const deleteLocalObject = await this.storage.deleteArtifact({ key: storageKey }, context);
    if (!deleteLocalObject.ok) {
      return createFailureResult(
        createContractError("unavailable", "Failed to delete local artifact object for registered artifact.", {
          details: {
            storageKey,
            cause: deleteLocalObject.error,
          },
        }),
        context,
      );
    }

    const deleteBindings = await this.artifactBindingStorage.deleteArtifactStorageBindings({
      artifactId: storageKey,
    }, context);
    if (!deleteBindings.ok) {
      return createFailureResult(
        createContractError("unavailable", "Failed to delete artifact backing bindings for registered artifact.", {
          details: {
            storageKey,
            cause: deleteBindings.error,
          },
        }),
        context,
      );
    }

    const deleteCatalog = await this.artifactCatalogDelete.deleteArtifactCatalogRecord({
      storageKey,
    }, context);

    if (!deleteCatalog.ok) {
      return createFailureResult(
        createContractError("unavailable", "Local artifact state was cleaned up but catalog deletion failed.", {
          details: {
            storageKey,
            localObjectDeleted: deleteLocalObject.value.deleted,
            bindingsDeleted: deleteBindings.value.deleted,
            cause: deleteCatalog.error,
          },
        }),
        context,
      );
    }

    if (!deleteCatalog.value.deleted) {
      return createFailureResult(
        createContractError("not-found", `Artifact \"${storageKey}\" is not registered.`),
        context,
      );
    }

    return createSuccessResult({ storageKey }, context);
  }
}
