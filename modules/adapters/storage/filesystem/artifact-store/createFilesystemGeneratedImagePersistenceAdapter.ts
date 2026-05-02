import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { LoggingPort } from "../../../../application/ports/logging";
import type { GeneratedImagePersistencePort } from "../../../../application/ports/image";
import type { ArtifactCatalogAppendPort } from "../../../../application/ports/artifact-catalog";
import { SystemArtifactIdFactory } from "../../../../domain/artifact";

export function createFilesystemGeneratedImagePersistenceAdapter(options: {
  comfyUiOutputRoot: string;
  artifactStorageRoot: string;
  logging?: LoggingPort;
  artifactCatalogAppend?: ArtifactCatalogAppendPort;
  now?: () => string;
}): GeneratedImagePersistencePort {
  const outputRoot = path.resolve(options.comfyUiOutputRoot);
  const storageRoot = path.resolve(options.artifactStorageRoot);
  const now = options.now ?? (() => new Date().toISOString());
  const artifactIdFactory = new SystemArtifactIdFactory();

  return {
    async persistGeneratedImage({ output }) {
      const safeOutput = path.resolve(outputRoot, output.subfolder ?? "", output.fileName);
      const relativeOutput = path.relative(outputRoot, safeOutput);
      if (relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
        throw new Error("ComfyUI output path traversal rejected.");
      }

      const artifactId = artifactIdFactory.createArtifactId({ artifactFamily: "image" }).value;
      const storageKey = `generated/images/${artifactId}.png`;
      const destinationPath = path.join(storageRoot, storageKey);
      await mkdir(path.dirname(destinationPath), { recursive: true });

      try {
        await rename(safeOutput, destinationPath);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "EXDEV") throw error;
        await options.logging?.log({ timestamp: new Date().toISOString(), level: "warn", verbosity: "normal", component: "storage.filesystem", event: "generated_image_move_fallback", message: "Cross-device rename failed, using copy-delete fallback." });
        await copyFile(safeOutput, destinationPath);
        await rm(safeOutput);
      }

      const [targetStats, targetBytes] = await Promise.all([stat(destinationPath), readFile(destinationPath)]);
      const checksum = createHash("sha256").update(targetBytes).digest("hex");
      if (options.artifactCatalogAppend) {
        const appendResult = await options.artifactCatalogAppend.appendArtifactCatalogRecord({
          record: {
            storageKey,
            artifactFamily: "image",
            mediaType: "image/png",
            sizeBytes: targetStats.size,
            sourceKind: "generated",
            originalName: output.fileName,
            createdAt: now(),
            checksum: { algorithm: "sha256", value: checksum },
          },
        });
        if (appendResult.ok === false) throw new Error(`Failed to register generated image artifact: ${appendResult.error.message}`);
      }

      return { artifactId, storageKey, mediaType: "image/png", sizeBytes: targetStats.size, checksum, originalFileName: output.fileName };
    },
  };
}
