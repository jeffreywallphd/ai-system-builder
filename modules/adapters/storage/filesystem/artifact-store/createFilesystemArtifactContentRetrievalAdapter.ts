import type { ArtifactCatalogReadPort } from "../../../../application/ports/artifact-catalog";
import type {
  ArtifactBrowserBoundaryContext,
} from "../../../../application/ports/artifact-browser";
import type {
  ArtifactContentRetrievalPort,
  RetrieveArtifactContentByStorageKeyRequest,
} from "../../../../application/ports/artifact-content";
import type { ArtifactStoragePort } from "../../../../application/ports/storage";
import { createContractError, createFailureResult, createSuccessResult } from "../../../../contracts/shared";
import { normalizeStorageArtifactKey } from "../../../../contracts/storage";

export interface CreateFilesystemArtifactContentRetrievalAdapterOptions {
  storage: Pick<ArtifactStoragePort, "retrieveArtifact">;
  artifactCatalogRead: ArtifactCatalogReadPort;
}

export function createFilesystemArtifactContentRetrievalAdapter(
  options: CreateFilesystemArtifactContentRetrievalAdapterOptions,
): ArtifactContentRetrievalPort {
  return {
    async retrieveArtifactContentByStorageKey(
      request: RetrieveArtifactContentByStorageKeyRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      const storageKey = normalizeStorageArtifactKey(request.storageKey);
      const [catalogResult, retrieveResult] = await Promise.all([
        options.artifactCatalogRead.readArtifactCatalogRecord({ storageKey }, context),
        options.storage.retrieveArtifact({
          key: storageKey,
          requestId: context.requestId,
          correlationId: context.correlationId,
        }),
      ]);

      if (!catalogResult.ok) {
        return catalogResult;
      }

      if (!retrieveResult.ok) {
        return createFailureResult(
          createContractError(retrieveResult.error.code, retrieveResult.error.message, {
            details: retrieveResult.error.details,
          }),
          context,
        );
      }

      const bytes = retrieveResult.value.content instanceof Uint8Array
        ? retrieveResult.value.content
        : new Uint8Array(retrieveResult.value.content as ArrayBufferLike);

      return createSuccessResult(
        {
          storageKey,
          mediaType: catalogResult.value.record.mediaType,
          sizeBytes: bytes.byteLength,
          bytes,
        },
        context,
      );
    },
  };
}
