import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "../../../../../testing/node-test";
import { createStoreArtifactRequest } from "../../../../../contracts/storage";
import { createLocalArtifactCatalogAdapter } from "../../artifact-catalog";
import {
  createFilesystemArtifactBrowserReadAdapter,
  createFilesystemArtifactStorageAdapter,
} from "..";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map(async (root) => rm(root, { recursive: true, force: true })));
  tempRoots = [];
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "artifact-browser-catalog-"));
  tempRoots.push(root);
  return root;
}

describe("filesystem artifact browser read adapter", () => {
  it("uses artifact catalog records from explicit catalog seam instead of filesystem traversal", async () => {
    const rootDirectory = await createTempRoot();
    const artifactCatalog = createLocalArtifactCatalogAdapter({ rootDirectory });
    const storage = createFilesystemArtifactStorageAdapter({
      rootDirectory,
      artifactCatalogAppend: artifactCatalog,
    });
    const browserRead = createFilesystemArtifactBrowserReadAdapter({
      artifactCatalogRead: artifactCatalog,
      storage,
    });

    await storage.storeArtifact(
      createStoreArtifactRequest(new Uint8Array([1, 2, 3]), {
        descriptor: {
          key: "uploads/session/cat.png",
          mediaType: "image/png",
          metadata: {
            originalFileName: "cat.png",
          },
        },
      }),
    );

    await mkdir(path.join(rootDirectory, "hidden"), { recursive: true });
    await writeFile(path.join(rootDirectory, "hidden", "not-cataloged.png"), new Uint8Array([9, 9]));

    const browseResult = await browserRead.browseArtifacts({ artifactKind: "image" });

    expect(browseResult.ok).toBe(true);
    if (!browseResult.ok) {
      throw new Error("Expected browse success.");
    }

    expect(browseResult.value.items.length).toBe(1);
    expect(browseResult.value.items[0]).toMatchObject({
      storageKey: "uploads/session/cat.png",
      artifactKind: "image",
      mediaType: "image/png",
      sizeBytes: 3,
      sourceKind: "upload",
      originalName: "cat.png",
    });
    expect(browseResult.value.items.find((item) => item.storageKey.includes("hidden"))).toBeUndefined();
  });

  it("keeps read/detail/content storage-key-based and path agnostic", async () => {
    const rootDirectory = await createTempRoot();
    const artifactCatalog = createLocalArtifactCatalogAdapter({ rootDirectory });
    const storage = createFilesystemArtifactStorageAdapter({
      rootDirectory,
      artifactCatalogAppend: artifactCatalog,
    });
    const browserRead = createFilesystemArtifactBrowserReadAdapter({
      artifactCatalogRead: artifactCatalog,
      storage,
    });

    await storage.storeArtifact(
      createStoreArtifactRequest(new Uint8Array([4, 5, 6, 7]), {
        descriptor: {
          key: "uploads/session/dog.png",
          mediaType: "image/png",
        },
      }),
    );

    const detail = await browserRead.readArtifactDetail({ locator: { storageKey: "uploads/session/dog.png" } });
    const content = await browserRead.readArtifactContent({ locator: { storageKey: "uploads/session/dog.png" } });

    expect(detail.ok).toBe(true);
    expect(content.ok).toBe(true);
    if (!detail.ok || !content.ok) {
      throw new Error("Expected detail/content success.");
    }

    expect(detail.value.artifact.locator.storageKey).toBe("uploads/session/dog.png");
    expect(content.value.content).toMatchObject({
      locator: { storageKey: "uploads/session/dog.png" },
      availability: "available",
      retrieval: "deferred",
    });
    expect("bytes" in content.value.content).toBe(false);
  });
});
