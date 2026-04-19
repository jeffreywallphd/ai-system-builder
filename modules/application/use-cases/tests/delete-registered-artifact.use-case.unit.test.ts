import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { createContractError } from "../../../contracts/shared";
import type { ArtifactCatalogDeletePort, ArtifactCatalogReadPort } from "../../ports/artifact-catalog";
import type { ArtifactObjectStoragePort, ArtifactStorageBindingPort } from "../../ports/storage";
import { DeleteRegisteredArtifactUseCase } from "../delete-registered-artifact.use-case";

describe("DeleteRegisteredArtifactUseCase", () => {
  it("deletes local object + bindings before deleting catalog record", async () => {
    const artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord"> = {
      readArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: true,
        value: {
          record: {
            storageKey: "artifacts/a-1",
            artifactFamily: "image",
          },
        },
      })),
    };
    const storage: Pick<ArtifactObjectStoragePort, "deleteArtifact"> = {
      deleteArtifact: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };
    const artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings"> = {
      deleteArtifactStorageBindings: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };
    const artifactCatalogDelete: ArtifactCatalogDeletePort = {
      deleteArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };

    const useCase = new DeleteRegisteredArtifactUseCase({
      artifactCatalogRead,
      artifactCatalogDelete,
      storage,
      artifactBindingStorage,
    });

    const result = await useCase.execute({ storageKey: "artifacts/a-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected success.");
    }
    expect(result.value.storageKey).toBe("artifacts/a-1");

    const readOrder = (artifactCatalogRead.readArtifactCatalogRecord as ReturnType<typeof testDouble.fn>).mock.invocationCallOrder[0];
    const storageOrder = (storage.deleteArtifact as ReturnType<typeof testDouble.fn>).mock.invocationCallOrder[0];
    const bindingOrder = (artifactBindingStorage.deleteArtifactStorageBindings as ReturnType<typeof testDouble.fn>).mock.invocationCallOrder[0];
    const catalogDeleteOrder = (artifactCatalogDelete.deleteArtifactCatalogRecord as ReturnType<typeof testDouble.fn>).mock.invocationCallOrder[0];

    expect(readOrder).toBeLessThan(storageOrder);
    expect(storageOrder).toBeLessThan(bindingOrder);
    expect(bindingOrder).toBeLessThan(catalogDeleteOrder);
  });

  it("fails without deleting catalog when local object deletion fails", async () => {
    const artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord"> = {
      readArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: true,
        value: {
          record: {
            storageKey: "artifacts/a-2",
            artifactFamily: "image",
          },
        },
      })),
    };
    const storage: Pick<ArtifactObjectStoragePort, "deleteArtifact"> = {
      deleteArtifact: testDouble.fn(async () => ({
        ok: false,
        error: createContractError("unavailable", "disk write failed"),
      })),
    };
    const artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings"> = {
      deleteArtifactStorageBindings: testDouble.fn(),
    };
    const artifactCatalogDelete: ArtifactCatalogDeletePort = {
      deleteArtifactCatalogRecord: testDouble.fn(),
    };

    const useCase = new DeleteRegisteredArtifactUseCase({
      artifactCatalogRead,
      artifactCatalogDelete,
      storage,
      artifactBindingStorage,
    });

    const result = await useCase.execute({ storageKey: "artifacts/a-2" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failure.");
    }
    expect(result.error.code).toBe("unavailable");
    expect(artifactBindingStorage.deleteArtifactStorageBindings).not.toHaveBeenCalled();
    expect(artifactCatalogDelete.deleteArtifactCatalogRecord).not.toHaveBeenCalled();
  });

  it("returns explicit partial-failure when catalog deletion fails after cleanup", async () => {
    const artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord"> = {
      readArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: true,
        value: {
          record: {
            storageKey: "artifacts/a-3",
            artifactFamily: "image",
          },
        },
      })),
    };
    const storage: Pick<ArtifactObjectStoragePort, "deleteArtifact"> = {
      deleteArtifact: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };
    const artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings"> = {
      deleteArtifactStorageBindings: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };
    const artifactCatalogDelete: ArtifactCatalogDeletePort = {
      deleteArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: false,
        error: createContractError("unavailable", "catalog unavailable"),
      })),
    };

    const useCase = new DeleteRegisteredArtifactUseCase({
      artifactCatalogRead,
      artifactCatalogDelete,
      storage,
      artifactBindingStorage,
    });

    const result = await useCase.execute({ storageKey: "artifacts/a-3" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failure.");
    }
    expect(result.error.code).toBe("unavailable");
    expect(result.error.message).toContain("catalog deletion failed");
    expect(result.error.details).toMatchObject({
      storageKey: "artifacts/a-3",
      localObjectDeleted: true,
      bindingsDeleted: true,
    });
  });

  it("fails without deleting catalog when binding cleanup fails", async () => {
    const artifactCatalogRead: Pick<ArtifactCatalogReadPort, "readArtifactCatalogRecord"> = {
      readArtifactCatalogRecord: testDouble.fn(async () => ({
        ok: true,
        value: {
          record: {
            storageKey: "artifacts/a-4",
            artifactFamily: "image",
          },
        },
      })),
    };
    const storage: Pick<ArtifactObjectStoragePort, "deleteArtifact"> = {
      deleteArtifact: testDouble.fn(async () => ({
        ok: true,
        value: { deleted: true },
      })),
    };
    const artifactBindingStorage: Pick<ArtifactStorageBindingPort, "deleteArtifactStorageBindings"> = {
      deleteArtifactStorageBindings: testDouble.fn(async () => ({
        ok: false,
        error: createContractError("unavailable", "binding file locked"),
      })),
    };
    const artifactCatalogDelete: ArtifactCatalogDeletePort = {
      deleteArtifactCatalogRecord: testDouble.fn(),
    };

    const useCase = new DeleteRegisteredArtifactUseCase({
      artifactCatalogRead,
      artifactCatalogDelete,
      storage,
      artifactBindingStorage,
    });

    const result = await useCase.execute({ storageKey: "artifacts/a-4" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failure.");
    }
    expect(result.error.code).toBe("unavailable");
    expect(result.error.message).toContain("backing bindings");
    expect(artifactCatalogDelete.deleteArtifactCatalogRecord).not.toHaveBeenCalled();
  });
});
