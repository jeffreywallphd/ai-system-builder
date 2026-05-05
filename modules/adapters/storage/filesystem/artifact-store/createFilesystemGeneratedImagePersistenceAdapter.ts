import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoggingPort } from "../../../../application/ports/logging";
import type { GeneratedImagePersistencePort } from "../../../../application/ports/image";
import type { ArtifactCatalogAppendPort } from "../../../../application/ports/artifact-catalog";
import type { ArtifactStorageBindingPort } from "../../../../application/ports/storage";
import { SystemArtifactIdFactory } from "../../../../domain/artifact";

export function createFilesystemGeneratedImagePersistenceAdapter(options: {
  comfyUiOutputRoot: string;
  artifactStorageRoot: string;
  logging?: LoggingPort;
  artifactCatalogAppend?: ArtifactCatalogAppendPort;
  artifactStorageBinding?: Pick<ArtifactStorageBindingPort, "upsertArtifactStorageBinding">;
  now?: () => string;
}): GeneratedImagePersistencePort {
  const outputRoot = path.resolve(options.comfyUiOutputRoot);
  const storageRoot = path.resolve(options.artifactStorageRoot);
  const now = options.now ?? (() => new Date().toISOString());
  const artifactIdFactory = new SystemArtifactIdFactory();

  return {
    async persistGeneratedImage({ output, preferredFileName }) {
      const artifactId = artifactIdFactory.createArtifactId().toString();
      const desiredFileName = sanitizeFileName(preferredFileName) ?? sanitizeFileName(output.fileName) ?? "generated-image.png";
      const storageKey = await reserveGeneratedImageStorageKey(storageRoot, desiredFileName);
      const destinationPath = path.join(storageRoot, storageKey);
      await mkdir(path.dirname(destinationPath), { recursive: true });

      if (output.contentBase64 && output.contentBase64.trim()) {
        await options.logging?.log({ timestamp: new Date().toISOString(), level: "info", verbosity: "normal", component: "storage.filesystem", event: "generated_image_preview_memory_cached", message: `Persisting generated image from in-memory output for ${output.fileName}.` });
        await writeFile(destinationPath, Buffer.from(output.contentBase64, "base64"));
        const sourcePath = path.resolve(outputRoot, output.subfolder ?? "", output.fileName);
        await rm(sourcePath, { force: true }).catch(() => undefined);
      } else {
        const sourcePath = path.resolve(outputRoot, output.subfolder ?? "", output.fileName);
        const relativeOutput = path.relative(outputRoot, sourcePath);
        if (relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) throw new Error("ComfyUI output path traversal rejected.");
        try {
          await rename(sourcePath, destinationPath);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== "EXDEV") throw error;
          await options.logging?.log({ timestamp: new Date().toISOString(), level: "warn", verbosity: "normal", component: "storage.filesystem", event: "generated_image_move_fallback", message: "Cross-device rename failed, using copy-delete fallback." });
          await copyFile(sourcePath, destinationPath);
          await rm(sourcePath);
        }
        await stat(sourcePath).then(() => { throw new Error("Generated image source still exists after finalization."); }, () => undefined);
        await options.logging?.log({ timestamp: new Date().toISOString(), level: "info", verbosity: "normal", component: "storage.filesystem", event: "generated_image_output_deleted", message: `Deleted ComfyUI output after persistence for ${output.fileName}.` });
      }

      const [destinationStats, destinationBytes] = await Promise.all([stat(destinationPath), readFile(destinationPath)]);
      if (!destinationStats.isFile()) throw new Error("Generated image destination is not a file.");

      const checksum = { algorithm: "sha256" as const, value: createHash("sha256").update(destinationBytes).digest("hex") };
      const createdAt = now();
      if (options.artifactCatalogAppend) {
        const appendResult = await options.artifactCatalogAppend.appendArtifactCatalogRecord({ record: { storageKey, artifactFamily: "image", mediaType: "image/png", sizeBytes: destinationStats.size, sourceKind: "generated", originalName: output.fileName, createdAt, checksum } });
        if (!appendResult.ok) throw new Error(`Failed to register generated image artifact: ${appendResult.error.message}`);
      }
      if (options.artifactStorageBinding) {
        const bindingResult = await options.artifactStorageBinding.upsertArtifactStorageBinding({ binding: { artifactId, role: "primary", backing: { kind: "artifact-object", provider: "filesystem", locator: storageKey, verification: { exists: true, verifiedAt: createdAt } }, createdAt } });
        if (!bindingResult.ok) throw new Error(`Failed to persist generated image primary binding: ${bindingResult.error.message}`);
      }
      await options.logging?.log({ timestamp: new Date().toISOString(), level: "info", verbosity: "normal", component: "storage.filesystem", event: "generated_image_persist_succeeded", message: `Persisted generated image ${output.fileName} as ${storageKey} (${artifactId}).` });

      return { artifactId, storageKey, mediaType: "image/png", sizeBytes: destinationStats.size, checksum, originalFileName: output.fileName };
    },
  };
}

function sanitizeFileName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replaceAll("\\", "/").split("/").pop()?.trim();
  if (!normalized) return undefined;
  const stripped = normalized.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!stripped) return undefined;
  if (/\.[a-zA-Z0-9]+$/.test(stripped)) return stripped;
  return `${stripped}.png`;
}

async function reserveGeneratedImageStorageKey(storageRoot: string, desiredFileName: string): Promise<string> {
  const parsed = path.parse(desiredFileName);
  const ext = parsed.ext || ".png";
  const base = parsed.name || "generated-image";
  let next = 0;
  while (next < 10_000) {
    const candidate = next === 0 ? `${base}${ext}` : `${base}-${next + 1}${ext}`;
    const storageKey = `generated/images/${candidate}`;
    try {
      await access(path.join(storageRoot, storageKey), constants.F_OK);
      next += 1;
    } catch {
      return storageKey;
    }
  }
  throw new Error("Unable to reserve generated image file name.");
}
