import type {
  ArtifactCatalogReadPort,
  ArtifactCatalogRecord,
} from "../../../../application/ports/artifact-catalog";
import type {
  ArtifactBrowserContentReadPort,
  ArtifactBrowserMetadataReadPort,
  BrowseArtifactsRequest,
  ReadArtifactContentRequest,
  ReadArtifactDetailRequest,
} from "../../../../application/ports/artifact-browser";
import type { ApplicationRequestContext } from "../../../../application/ports";
import type { ArtifactObjectStoragePort } from "../../../../application/ports/storage";
import type { ArtifactStorageBindingPort } from "../../../../application/ports/storage";
import {
  createArtifactBrowserLocator,
  type ArtifactBrowseItem,
  type ArtifactContentReadSuccessValue,
  type ArtifactReadSuccessValue,
} from "../../../../contracts/artifact-browser";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../../../contracts/shared";
import {
  decodeArtifactRepoBackingLocator,
  normalizeStorageArtifactKey,
  type StorageObjectMetadata,
} from "../../../../contracts/storage";

export interface FilesystemArtifactBrowserReadAdapter
  extends ArtifactBrowserMetadataReadPort,
  ArtifactBrowserContentReadPort {}

export interface CreateFilesystemArtifactBrowserReadAdapterOptions {
  artifactCatalogRead: ArtifactCatalogReadPort;
  storage?: Pick<ArtifactObjectStoragePort, "hasArtifact">;
  artifactBindingRead?: Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings">;
}

interface PublishedBackingReadModel {
  provider: string;
  repository: string;
  path: string;
  revision?: string;
}

async function readPublishedBacking(
  options: CreateFilesystemArtifactBrowserReadAdapterOptions,
  artifactId: string,
  context: ApplicationRequestContext,
): Promise<PublishedBackingReadModel | undefined> {
  if (!options.artifactBindingRead) {
    return undefined;
  }

  const bindingsResult = await options.artifactBindingRead.readArtifactStorageBindings({ artifactId }, context);
  if (!bindingsResult.ok) {
    return undefined;
  }

  const latestPublishedBinding = bindingsResult.value.bindings
    .filter((binding) => binding.role === "published" && binding.backing.kind === "artifact-repo")
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0];

  if (!latestPublishedBinding) {
    return undefined;
  }

  const locator = latestPublishedBinding.backing.target?.repository
    && latestPublishedBinding.backing.target.path
    ? {
      repository: latestPublishedBinding.backing.target.repository,
      path: latestPublishedBinding.backing.target.path,
    }
    : (() => {
      try {
        return decodeArtifactRepoBackingLocator(latestPublishedBinding.backing.locator);
      } catch {
        return undefined;
      }
    })();
  if (!locator) {
    return undefined;
  }

  return {
    provider: latestPublishedBinding.backing.provider,
    repository: locator.repository,
    path: locator.path,
    revision: latestPublishedBinding.backing.revision,
  };
}

function toBrowseItem(record: ArtifactCatalogRecord): ArtifactBrowseItem {
  return {
    storageKey: record.storageKey,
    artifactKind: "image",
    mediaType: record.mediaType,
    sizeBytes: record.sizeBytes,
    sourceKind: record.sourceKind,
    originalName: record.originalName,
    createdAt: record.createdAt,
  };
}

function toDetailValue(record: ArtifactCatalogRecord): ArtifactReadSuccessValue {
  return {
    artifact: {
      locator: createArtifactBrowserLocator(record.storageKey),
      artifactKind: "image",
      mediaType: record.mediaType,
      sizeBytes: record.sizeBytes,
      checksum: record.checksum,
      sourceKind: record.sourceKind,
      originalName: record.originalName,
      createdAt: record.createdAt,
    },
  };
}

function toContentValue(record: ArtifactCatalogRecord): ArtifactContentReadSuccessValue {
  return {
    content: {
      locator: createArtifactBrowserLocator(record.storageKey),
      mediaType: record.mediaType,
      sizeBytes: record.sizeBytes,
      availability: "available",
      retrieval: "deferred",
    },
  };
}

export function createFilesystemArtifactBrowserReadAdapter(
  options: CreateFilesystemArtifactBrowserReadAdapterOptions,
): FilesystemArtifactBrowserReadAdapter {
  return {
    async browseArtifacts(
      request: BrowseArtifactsRequest,
      context: ApplicationRequestContext = {},
    ) {
      const browseResult = await options.artifactCatalogRead.browseArtifactCatalogRecords(
        {
          artifactKind: request.artifactKind,
        },
        context,
      );

      if (!browseResult.ok) {
        return browseResult;
      }

      const items = browseResult.value.records
        .map((record) => toBrowseItem(record))
        .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

      return createSuccessResult({ items }, context);
    },

    async readArtifactDetail<TMetadata extends StorageObjectMetadata = StorageObjectMetadata>(
      request: ReadArtifactDetailRequest,
      context: ApplicationRequestContext = {},
    ) {
      const storageKey = normalizeStorageArtifactKey(request.locator.storageKey);
      const readResult = await options.artifactCatalogRead.readArtifactCatalogRecord(
        { storageKey },
        context,
      );

      if (!readResult.ok) {
        return readResult;
      }

      const detail = toDetailValue(readResult.value.record) as ArtifactReadSuccessValue<TMetadata>;
      const publishedBacking = await readPublishedBacking(options, storageKey, context);
      if (publishedBacking) {
        detail.artifact.metadata = {
          ...(detail.artifact.metadata ?? {}),
          publishedBacking,
        } as TMetadata;
      }

      return createSuccessResult(detail, context);
    },

    async readArtifactContent(
      request: ReadArtifactContentRequest,
      context: ApplicationRequestContext = {},
    ) {
      const storageKey = normalizeStorageArtifactKey(request.locator.storageKey);
      const readResult = await options.artifactCatalogRead.readArtifactCatalogRecord(
        { storageKey },
        context,
      );

      if (!readResult.ok) {
        return readResult;
      }

      if (options.storage) {
        const hasArtifactResult = await options.storage.hasArtifact(
          {
            key: storageKey,
          },
          context,
        );

        if (!hasArtifactResult.ok) {
          return createFailureResult(
            createContractError(
              hasArtifactResult.error.code === "validation" ? "unavailable" : hasArtifactResult.error.code,
              hasArtifactResult.error.message,
              { details: hasArtifactResult.error.details },
            ),
            context,
          );
        }

        if (!hasArtifactResult.value.exists) {
          return createFailureResult(
            createContractError(
              "not-found",
              `Artifact content not found for storage key \"${storageKey}\".`,
            ),
            context,
          );
        }
      }

      return createSuccessResult(toContentValue(readResult.value.record), context);
    },
  };
}
