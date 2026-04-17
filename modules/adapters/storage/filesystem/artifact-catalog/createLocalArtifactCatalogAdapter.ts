import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactCatalogAppendPort,
  ArtifactCatalogReadPort,
  ArtifactCatalogRecord,
} from "../../../../application/ports/artifact-catalog";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../../../contracts/shared";
import { normalizeStorageArtifactKey } from "../../../../contracts/storage";

const DEFAULT_CATALOG_FILE = ".catalog/artifact-catalog.ndjson";

export interface CreateLocalArtifactCatalogAdapterOptions {
  rootDirectory: string;
  catalogFile?: string;
}

export interface LocalArtifactCatalogAdapter extends ArtifactCatalogAppendPort, ArtifactCatalogReadPort {}

function normalizeRecord(record: ArtifactCatalogRecord): ArtifactCatalogRecord {
  return {
    ...record,
    storageKey: normalizeStorageArtifactKey(record.storageKey),
    artifactKind: "image",
  };
}

function parseRecordLine(line: string): ArtifactCatalogRecord | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<ArtifactCatalogRecord>;
    if (parsed.artifactKind !== "image" || typeof parsed.storageKey !== "string") {
      return undefined;
    }

    return normalizeRecord({
      storageKey: parsed.storageKey,
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
    });
  } catch {
    return undefined;
  }
}

export function createLocalArtifactCatalogAdapter(
  options: CreateLocalArtifactCatalogAdapterOptions,
): LocalArtifactCatalogAdapter {
  const rootDirectory = path.resolve(options.rootDirectory);
  const catalogFile = options.catalogFile ?? DEFAULT_CATALOG_FILE;
  const catalogPath = path.join(rootDirectory, catalogFile);

  async function readCatalogRecords(): Promise<ArtifactCatalogRecord[]> {
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

  return {
    async appendArtifactCatalogRecord(request, context = {}) {
      try {
        const record = normalizeRecord(request.record);
        await mkdir(path.dirname(catalogPath), { recursive: true });
        await appendFile(catalogPath, `${JSON.stringify(record)}\n`, "utf8");
        return createSuccessResult({ storageKey: record.storageKey }, context);
      } catch (error) {
        return createFailureResult(
          createContractError("unavailable", "Failed to append artifact catalog record.", {
            details: {
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
          context,
        );
      }
    },

    async browseArtifactCatalogRecords(request, context = {}) {
      if (request.artifactKind !== "image") {
        return createFailureResult(
          createContractError("validation", `artifactKind must be \"image\". Received \"${request.artifactKind}\".`),
          context,
        );
      }

      return createSuccessResult({ records: await readCatalogRecords() }, context);
    },

    async readArtifactCatalogRecord(request, context = {}) {
      const storageKey = normalizeStorageArtifactKey(request.storageKey);
      const record = (await readCatalogRecords()).find((entry) => entry.storageKey === storageKey);
      if (!record) {
        return createFailureResult(
          createContractError("not-found", `Artifact not found for storage key \"${storageKey}\".`),
          context,
        );
      }

      return createSuccessResult({ record }, context);
    },
  };
}
