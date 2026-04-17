import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactBrowserContentReadPort,
  ArtifactBrowserMetadataReadPort,
  ArtifactBrowserBoundaryContext,
  BrowseArtifactsRequest,
  ReadArtifactContentRequest,
  ReadArtifactDetailRequest,
} from "../../../../application/ports/artifact-browser";
import {
  createArtifactBrowserLocator,
  type ArtifactBrowseItem,
} from "../../../../contracts/artifact-browser";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../../../contracts/shared";

const IMAGE_EXTENSIONS_TO_MEDIA_TYPE: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export interface FilesystemArtifactBrowserReadAdapter
  extends ArtifactBrowserMetadataReadPort,
  ArtifactBrowserContentReadPort {}

export interface CreateFilesystemArtifactBrowserReadAdapterOptions {
  rootDirectory: string;
}

interface ResolvedArtifactFile {
  storageKey: string;
  absolutePath: string;
  mediaType: string;
  sizeBytes: number;
  createdAt?: string;
}

function toMediaType(filePath: string): string | undefined {
  return IMAGE_EXTENSIONS_TO_MEDIA_TYPE[path.extname(filePath).toLowerCase()];
}

function createStorageKey(rootDirectory: string, absolutePath: string): string {
  return path.relative(rootDirectory, absolutePath).split(path.sep).join("/");
}

async function walkFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function resolveArtifactFile(
  rootDirectory: string,
  storageKey: string,
): Promise<ResolvedArtifactFile | undefined> {
  const normalizedSegments = storageKey
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  if (normalizedSegments.length === 0) {
    return undefined;
  }

  const absolutePath = path.resolve(rootDirectory, ...normalizedSegments);
  const relativePath = path.relative(rootDirectory, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  try {
    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile()) {
      return undefined;
    }

    const mediaType = toMediaType(absolutePath);
    if (!mediaType) {
      return undefined;
    }

    return {
      storageKey: normalizedSegments.join("/"),
      absolutePath,
      mediaType,
      sizeBytes: fileStats.size,
      createdAt: Number.isNaN(fileStats.birthtimeMs) ? undefined : fileStats.birthtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

export function createFilesystemArtifactBrowserReadAdapter(
  options: CreateFilesystemArtifactBrowserReadAdapterOptions,
): FilesystemArtifactBrowserReadAdapter {
  const rootDirectory = path.resolve(options.rootDirectory);

  return {
    async browseArtifacts(
      request: BrowseArtifactsRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      if (request.artifactKind !== "image") {
        return createFailureResult(
          createContractError(
            "validation",
            `artifactKind must be \"image\". Received \"${request.artifactKind}\".`,
          ),
          context,
        );
      }

      let files: string[];
      try {
        files = await walkFiles(rootDirectory);
      } catch {
        files = [];
      }

      const items: ArtifactBrowseItem[] = [];
      for (const filePath of files) {
        const mediaType = toMediaType(filePath);
        if (!mediaType) {
          continue;
        }

        const fileStats = await stat(filePath);
        items.push({
          storageKey: createStorageKey(rootDirectory, filePath),
          artifactKind: "image",
          mediaType,
          sizeBytes: fileStats.size,
          createdAt: Number.isNaN(fileStats.birthtimeMs) ? undefined : fileStats.birthtime.toISOString(),
        });
      }

      items.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

      return createSuccessResult({ items }, context);
    },

    async readArtifactDetail(
      request: ReadArtifactDetailRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      const artifact = await resolveArtifactFile(rootDirectory, request.locator.storageKey);
      if (!artifact) {
        return createFailureResult(
          createContractError(
            "not-found",
            `Artifact not found for storage key \"${request.locator.storageKey}\".`,
          ),
          context,
        );
      }

      return createSuccessResult(
        {
          artifact: {
            locator: createArtifactBrowserLocator(artifact.storageKey),
            artifactKind: "image",
            mediaType: artifact.mediaType,
            sizeBytes: artifact.sizeBytes,
            createdAt: artifact.createdAt,
          },
        },
        context,
      );
    },

    async readArtifactContent(
      request: ReadArtifactContentRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      const artifact = await resolveArtifactFile(rootDirectory, request.locator.storageKey);
      if (!artifact) {
        return createFailureResult(
          createContractError(
            "not-found",
            `Artifact content not found for storage key \"${request.locator.storageKey}\".`,
          ),
          context,
        );
      }

      return createSuccessResult(
        {
          content: {
            locator: createArtifactBrowserLocator(artifact.storageKey),
            mediaType: artifact.mediaType,
            sizeBytes: artifact.sizeBytes,
            availability: "available",
            retrieval: "deferred",
          },
        },
        context,
      );
    },
  };
}
