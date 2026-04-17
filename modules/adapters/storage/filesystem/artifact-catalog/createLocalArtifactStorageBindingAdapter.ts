import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactStorageBindingPort } from "../../../../application/ports/storage";
import { createContractError, createFailureResult, createSuccessResult } from "../../../../contracts/shared";
import {
  normalizeArtifactStorageBinding,
  type ArtifactStorageBinding,
} from "../../../../contracts/storage";

const DEFAULT_BINDINGS_FILE = ".catalog/artifact-storage-bindings.ndjson";

export interface CreateLocalArtifactStorageBindingAdapterOptions {
  rootDirectory: string;
  bindingsFile?: string;
}

function parseBindingLine(line: string): ArtifactStorageBinding | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<ArtifactStorageBinding>;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    if (
      typeof parsed.artifactId !== "string"
      || typeof parsed.role !== "string"
      || typeof parsed.backing !== "object"
      || parsed.backing === null
    ) {
      return undefined;
    }

    return normalizeArtifactStorageBinding({
      artifactId: parsed.artifactId,
      role: parsed.role,
      backing: parsed.backing as ArtifactStorageBinding["backing"],
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
    });
  } catch {
    return undefined;
  }
}

export function createLocalArtifactStorageBindingAdapter(
  options: CreateLocalArtifactStorageBindingAdapterOptions,
): ArtifactStorageBindingPort {
  const rootDirectory = path.resolve(options.rootDirectory);
  const bindingsFile = options.bindingsFile ?? DEFAULT_BINDINGS_FILE;
  const bindingsPath = path.join(rootDirectory, bindingsFile);

  async function readBindings(): Promise<ArtifactStorageBinding[]> {
    const content = await readFile(bindingsPath, "utf8").catch(() => "");
    if (!content.trim()) {
      return [];
    }

    const latestByCompositeKey = new Map<string, ArtifactStorageBinding>();
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const parsed = parseBindingLine(line);
      if (!parsed) {
        continue;
      }

      const key = `${parsed.artifactId}::${parsed.role}::${parsed.backing.provider}::${parsed.backing.locator}`;
      latestByCompositeKey.set(key, parsed);
    }

    return Array.from(latestByCompositeKey.values());
  }

  return {
    async upsertArtifactStorageBinding(request, context = {}) {
      try {
        const normalizedBinding = normalizeArtifactStorageBinding(request.binding);
        await mkdir(path.dirname(bindingsPath), { recursive: true });
        await appendFile(bindingsPath, `${JSON.stringify(normalizedBinding)}\n`, "utf8");
        return createSuccessResult({ binding: normalizedBinding }, context);
      } catch (error) {
        return createFailureResult(
          createContractError("unavailable", "Failed to persist artifact storage binding.", {
            details: {
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
          context,
        );
      }
    },

    async readArtifactStorageBindings(request, context = {}) {
      const artifactId = request.artifactId?.trim();
      if (!artifactId) {
        return createFailureResult(
          createContractError("validation", "artifactId must be a non-empty string."),
          context,
        );
      }

      const bindings = (await readBindings()).filter((entry) => entry.artifactId === artifactId);
      return createSuccessResult({ bindings }, context);
    },
  };
}
