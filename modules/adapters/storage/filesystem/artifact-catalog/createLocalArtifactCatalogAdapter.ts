import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactCatalogAppendPort,
  ArtifactCatalogDeletePort,
  ArtifactCatalogReadPort,
  ArtifactCatalogRecord,
} from "../../../../application/ports/artifact-catalog";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../../../contracts/shared";
import { normalizeStorageArtifactKey } from "../../../../contracts/storage";
import { createWorkspaceId, isWorkspaceId } from "../../../../contracts/workspace";
import { normalizeArtifactFamily } from "../../../../domain/artifact";

const DEFAULT_CATALOG_FILE = ".catalog/artifact-catalog.ndjson";

type ArtifactCatalogRecordLine = ArtifactCatalogRecord | { workspaceId: string; storageKey: string; deletedAt: string };

export interface CreateLocalArtifactCatalogPersistenceAdapterOptions {
  rootDirectory: string;
  catalogFile?: string;
}

export interface LocalArtifactCatalogPersistenceAdapter
  extends ArtifactCatalogAppendPort, ArtifactCatalogReadPort, ArtifactCatalogDeletePort {}

function normalizeRecord(record: ArtifactCatalogRecord): ArtifactCatalogRecord {
  return {
    ...record,
    ...(record.workspaceId ? { workspaceId: createWorkspaceId(record.workspaceId) } : {}),
    storageKey: normalizeStorageArtifactKey(record.storageKey),
    artifactFamily: normalizeArtifactFamily(record.artifactFamily),
  };
}

function isFsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function toFilesystemCode(error: unknown): string | undefined {
  return isFsError(error) ? error.code : undefined;
}

function createCatalogUnavailableError(operation: string, error: unknown) {
  return createContractError("unavailable", "Artifact catalog is unavailable.", {
    details: {
      operation,
      filesystemCode: toFilesystemCode(error),
    },
  });
}

function parseRecordLine(line: string): ArtifactCatalogRecordLine | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<ArtifactCatalogRecord> & { deletedAt?: unknown };
    if (typeof parsed.storageKey !== "string") {
      return undefined;
    }

    if (typeof parsed.deletedAt === "string" && parsed.deletedAt.trim().length > 0) {
      if (!isWorkspaceId(parsed.workspaceId)) {
        return undefined;
      }
      return { workspaceId: parsed.workspaceId, storageKey: normalizeStorageArtifactKey(parsed.storageKey), deletedAt: parsed.deletedAt };
    }

    if (typeof parsed.artifactFamily !== "string" || parsed.artifactFamily.trim().length === 0) {
      return undefined;
    }

    if (parsed.workspaceId !== undefined && !isWorkspaceId(parsed.workspaceId)) {
      return undefined;
    }

    return normalizeRecord({
      ...(parsed.workspaceId ? { workspaceId: parsed.workspaceId } : {}),
      storageKey: parsed.storageKey,
      artifactFamily: normalizeArtifactFamily(parsed.artifactFamily),
      mediaType: typeof parsed.mediaType === "string" ? parsed.mediaType : undefined,
      sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : undefined,
      sourceKind: parsed.sourceKind === "upload" || parsed.sourceKind === "generated" ? parsed.sourceKind : undefined,
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

export function createLocalArtifactCatalogPersistenceAdapter(
  options: CreateLocalArtifactCatalogPersistenceAdapterOptions,
): LocalArtifactCatalogPersistenceAdapter {
  const rootDirectory = path.resolve(options.rootDirectory);
  const catalogFile = options.catalogFile ?? DEFAULT_CATALOG_FILE;
  const catalogPath = path.join(rootDirectory, catalogFile);

  async function readCatalogRecords(): Promise<ArtifactCatalogRecord[]> {
    let content: string;
    try {
      content = await readFile(catalogPath, "utf8");
    } catch (error) {
      if (isFsError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }

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

      if ("deletedAt" in record) {
        latestByStorageKey.delete(`${record.workspaceId}:${record.storageKey}`);
        continue;
      }

      latestByStorageKey.set(`${record.workspaceId ?? "legacy"}:${record.storageKey}`, record);
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
              operation: "appendArtifactCatalogRecord",
              filesystemCode: toFilesystemCode(error),
            },
          }),
          context,
        );
      }
    },

    async browseArtifactCatalogRecords(request, context = {}) {
      if (!isWorkspaceId(request.workspaceId)) {
        return createFailureResult(
          createContractError("validation", "Workspace id is required for artifact catalog browse.", {
            details: { code: "workspace-required" },
          }),
          context,
        );
      }

      try {
        const records = (await readCatalogRecords()).filter((record) => record.workspaceId === request.workspaceId);
        return createSuccessResult({
          records: request.artifactFamily
            ? records.filter((record) => record.artifactFamily === request.artifactFamily)
            : records,
        }, context);
      } catch (error) {
        return createFailureResult(createCatalogUnavailableError("browseArtifactCatalogRecords", error), context);
      }
    },

    async readArtifactCatalogRecord(request, context = {}) {
      if (!isWorkspaceId(request.workspaceId)) {
        return createFailureResult(
          createContractError("validation", "Workspace id is required for artifact catalog read.", {
            details: { code: "workspace-required" },
          }),
          context,
        );
      }
      const storageKey = normalizeStorageArtifactKey(request.storageKey);
      let record: ArtifactCatalogRecord | undefined;
      try {
        record = (await readCatalogRecords()).find((entry) => entry.workspaceId === request.workspaceId && entry.storageKey === storageKey);
      } catch (error) {
        return createFailureResult(createCatalogUnavailableError("readArtifactCatalogRecord", error), context);
      }
      if (!record) {
        return createFailureResult(
          createContractError("not-found", `Artifact not found for storage key \"${storageKey}\".`),
          context,
        );
      }

      return createSuccessResult({ record }, context);
    },

    async deleteArtifactCatalogRecord(request, context = {}) {
      if (!isWorkspaceId(request.workspaceId)) {
        return createFailureResult(
          createContractError("validation", "Workspace id is required for artifact catalog delete.", {
            details: { code: "workspace-required" },
          }),
          context,
        );
      }
      const storageKey = normalizeStorageArtifactKey(request.storageKey);
      try {
        const records = await readCatalogRecords();
        const exists = records.some((entry) => entry.workspaceId === request.workspaceId && entry.storageKey === storageKey);
        if (!exists) {
          return createSuccessResult({ deleted: false }, context);
        }

        await mkdir(path.dirname(catalogPath), { recursive: true });
        await appendFile(catalogPath, `${JSON.stringify({ workspaceId: request.workspaceId, storageKey, deletedAt: new Date().toISOString() })}\n`, "utf8");
        return createSuccessResult({ deleted: true }, context);
      } catch (error) {
        return createFailureResult(createCatalogUnavailableError("deleteArtifactCatalogRecord", error), context);
      }
    },
  };
}

export type CreateLocalArtifactCatalogAdapterOptions =
  CreateLocalArtifactCatalogPersistenceAdapterOptions;
export type LocalArtifactCatalogAdapter = LocalArtifactCatalogPersistenceAdapter;

export const createLocalArtifactCatalogAdapter = createLocalArtifactCatalogPersistenceAdapter;
