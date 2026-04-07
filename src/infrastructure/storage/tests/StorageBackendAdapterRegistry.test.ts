import { describe, expect, it } from "bun:test";
import type { IStorageObjectPort } from "@application/storage/ports/StorageObjectPort";
import { StorageBackendTypes } from "@domain/storage/StorageDomain";
import { StorageBackendAdapterRegistry } from "../StorageBackendAdapterRegistry";

describe("StorageBackendAdapterRegistry", () => {
  it("rejects duplicate backend registrations", () => {
    expect(() => new StorageBackendAdapterRegistry([
      {
        backendType: StorageBackendTypes.managedFilesystem,
        provisioningPort: {
          async requestStorageProvisioning() {
            return {
              status: "accepted",
              accepted: true,
              occurredAt: "2026-04-06T12:00:00.000Z",
            } as const;
          },
        },
      },
      {
        backendType: StorageBackendTypes.managedFilesystem,
        provisioningPort: {
          async requestStorageProvisioning() {
            return {
              status: "accepted",
              accepted: true,
              occurredAt: "2026-04-06T12:00:00.000Z",
            } as const;
          },
        },
      },
    ])).toThrow("registered more than once");
  });

  it("resolves backend-specific storage object ports", () => {
    const objectPort: IStorageObjectPort = {
      createObjectKey() {
        return {
          objectKey: "assets/input/aa/bb/file.bin",
          normalizedFileName: "file.bin",
          partition: ["aa", "bb"],
        };
      },
      async writeObject() {
        return {
          objectKey: "assets/input/aa/bb/file.bin",
          sizeBytes: 1,
          checksum: {
            algorithm: "sha256",
            digest: "abc",
          },
          writtenAt: "2026-04-06T12:00:00.000Z",
        };
      },
      async objectExists() {
        return true;
      },
      async readObjectMetadata() {
        return {
          objectKey: "assets/input/aa/bb/file.bin",
          sizeBytes: 1,
          lastModifiedAt: "2026-04-06T12:00:00.000Z",
        };
      },
      async openObjectReadStream() {
        return (async function* stream() {
          yield new Uint8Array([1]);
        })();
      },
      async deleteObject() {
        return {
          objectKey: "assets/input/aa/bb/file.bin",
          deleted: true,
          deletedAt: "2026-04-06T12:00:00.000Z",
        };
      },
    };

    const registry = new StorageBackendAdapterRegistry([
      {
        backendType: StorageBackendTypes.managedFilesystem,
        provisioningPort: {
          async requestStorageProvisioning() {
            return {
              status: "accepted",
              accepted: true,
              occurredAt: "2026-04-06T12:00:00.000Z",
            } as const;
          },
        },
        objectPort,
      },
    ]);

    expect(registry.resolveStorageObjectPort(StorageBackendTypes.managedFilesystem)).toBe(objectPort);
    expect(registry.resolveStorageObjectPort(StorageBackendTypes.objectStorage)).toBeUndefined();
  });

  it("lists registered backend types as a stable frozen array", () => {
    const registry = new StorageBackendAdapterRegistry([
      {
        backendType: StorageBackendTypes.managedFilesystem,
        provisioningPort: {
          async requestStorageProvisioning() {
            return {
              status: "accepted",
              accepted: true,
              occurredAt: "2026-04-06T12:00:00.000Z",
            } as const;
          },
        },
      },
      {
        backendType: StorageBackendTypes.networkShare,
        provisioningPort: {
          async requestStorageProvisioning() {
            return {
              status: "accepted",
              accepted: true,
              occurredAt: "2026-04-06T12:00:00.000Z",
            } as const;
          },
        },
      },
    ]);

    const backends = registry.listBackendTypes();
    expect(backends).toEqual([StorageBackendTypes.managedFilesystem, StorageBackendTypes.networkShare]);
    expect(Object.isFrozen(backends)).toBeTrue();
  });
});

