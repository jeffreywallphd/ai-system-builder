import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalSystemOutputArtifactStorage } from "../LocalSystemOutputArtifactStorage";

describe("LocalSystemOutputArtifactStorage", () => {
  it("persists artifacts with normalized names and collision-safe references", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "system-output-store-"));
    try {
      const storage = new LocalSystemOutputArtifactStorage(root);
      const requestBase = {
        systemId: "system:image",
        datasetInstanceId: "instance:outputs",
        workflowRunId: "run:1",
        materializationId: "mat:1",
        role: "primary" as const,
        payload: new Uint8Array([1, 2, 3]),
        fileNameHint: "Hero Final.png",
        extensionHint: "png",
        mimeTypeHint: "image/png",
      };

      const first = await storage.persist({ ...requestBase, assetIndex: 0 });
      const second = await storage.persist({ ...requestBase, assetIndex: 1 });

      expect(first.storageProvider).toBe("system-owned-filesystem-output-store");
      expect(first.metadata.fileName).toBe("hero-final-primary.png");
      expect(second.metadata.fileName).toBe("hero-final-primary-1.png");
      expect(first.storageReference.startsWith("system-output://")).toBe(true);
      expect(first.assetRef.stableId).not.toBe(second.assetRef.stableId);
      expect(first.metadata.sha256).toBe(second.metadata.sha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
