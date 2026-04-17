import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactBrowserBoundaryContext,
  ArtifactBrowserContentReadPort,
  ArtifactBrowserMetadataReadPort,
  BrowseArtifactsRequest,
  ReadArtifactContentRequest,
  ReadArtifactDetailRequest,
} from "../../../../application/ports/artifact-browser";
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
  normalizeStorageArtifactKey,
  type StorageObjectMetadata,
} from "../../../../contracts/storage";

const ARTIFACT_CATALOG_FILE = ".catalog/artifact-browser.ndjson";

interface ArtifactCatalogRecord {
  storageKey: string;
  artifactKind: "image";
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: "upload";
  originalName?: string;
  createdAt?: string;
  checksum?: {
    algorithm: string;
    value: string;
  };
}

export interface FilesystemArtifactBrowserReadAdapter
  extends ArtifactBrowserMetadataReadPort,
  ArtifactBrowserContentReadPort {}

export interface CreateFilesystemArtifactBrowserReadAdapterOptions {
  rootDirectory: string;
}

function toCatalogPath(rootDirectory: string): string {
  return path.join(rootDirectory, ARTIFACT_CATALOG_FILE);
}

function parseRecordLine(line: string): ArtifactCatalogRecord | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<ArtifactCatalogRecord>;
    if (parsed.artifactKind !== "image" || typeof parsed.storageKey !== "string") {
      return undefined;
    }

    return {
      storageKey: normalizeStorageArtifactKey(parsed.storageKey),
      artifactKind: "image",
      mediaType: typeof parsed.mediaType === "string" ? parsed.mediaType : undefined,
      sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : undefined,
      sourceKind: parsed.sourceKind === "upload" ? "upload" : undefined,
      originalName: typeof parsed.originalName === "string" ? parsed.originalName : undefined,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      checksum:
        parsed.checksum
        && typeof parsed.checksum === "object"
        && typeof parsed.checksum.algorithm === "string"
        && typeof parsed.checksum.value === "string"
          ? {
            algorithm: parsed.checksum.algorithm,
            value: parsed.checksum.value,
          }
          : undefined,
    };
  } catch {
    return undefined;
  }
}

async function readCatalogRecords(rootDirectory: string): Promise<ArtifactCatalogRecord[]> {
  const catalogPath = toCatalogPath(rootDirectory);
  const content = await readFile(catalogPath, "utf8").catch(() => "");
  if (!content.trim()) {
    return [];
  }

  const latestByStorageKey = new Map<string, ArtifactCatalogRecord>();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const record = parseRecordLine(line);
    if (!record) {
      continue;
    }

    latestByStorageKey.set(record.storageKey, record);
  }

  return Array.from(latestByStorageKey.values());
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

export async function appendArtifactCatalogRecord(
  rootDirectory: string,
  record: ArtifactCatalogRecord,
): Promise<void> {
  const catalogPath = toCatalogPath(rootDirectory);
  await mkdir(path.dirname(catalogPath), { recursive: true });
  await appendFile(catalogPath, `${JSON.stringify(record)}\n`, "utf8");
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

      const records = await readCatalogRecords(rootDirectory);
      const items = records
        .map((record) => toBrowseItem(record))
        .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

      return createSuccessResult({ items }, context);
    },

    async readArtifactDetail<TMetadata extends StorageObjectMetadata = StorageObjectMetadata>(
      request: ReadArtifactDetailRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      const storageKey = normalizeStorageArtifactKey(request.locator.storageKey);
      const record = (await readCatalogRecords(rootDirectory)).find(
        (entry) => entry.storageKey === storageKey,
      );

      if (!record) {
        return createFailureResult(
          createContractError("not-found", `Artifact not found for storage key \"${storageKey}\".`),
          context,
        );
      }

      return createSuccessResult(toDetailValue(record) as ArtifactReadSuccessValue<TMetadata>, context);
    },

    async readArtifactContent(
      request: ReadArtifactContentRequest,
      context: ArtifactBrowserBoundaryContext = {},
    ) {
      const storageKey = normalizeStorageArtifactKey(request.locator.storageKey);
      const record = (await readCatalogRecords(rootDirectory)).find(
        (entry) => entry.storageKey === storageKey,
      );

      if (!record) {
        return createFailureResult(
          createContractError(
            "not-found",
            `Artifact content not found for storage key \"${storageKey}\".`,
          ),
          context,
        );
      }

      return createSuccessResult(toContentValue(record), context);
    },
  };
}
