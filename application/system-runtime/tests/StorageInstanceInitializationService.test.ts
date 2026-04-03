import { describe, expect, it } from "bun:test";
import {
  DeterministicStorageInstanceProvisioner,
  InMemoryStorageInstanceMetadataRepository,
  StorageInstanceInitializationService,
} from "../StorageInstanceInitializationService";

describe("StorageInstanceInitializationService", () => {
  it("provisions a storage instance when none is attached", async () => {
    const service = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      new InMemoryStorageInstanceMetadataRepository(),
      () => new Date("2026-04-03T00:00:00.000Z"),
    );

    const initialized = await service.initialize({
      strategy: "provision",
      instanceId: "storage-instance:reference-image:runtime",
      owner: {
        ownerKind: "system",
        ownerId: "system:reference-image",
        role: "runtime-io",
      },
      requestedBindings: ["input", "output", "intermediate"],
    });

    expect(initialized.provisioned).toBeTrue();
    expect(initialized.metadata.instanceId).toBe("storage-instance:reference-image:runtime");
    expect(initialized.metadata.attachments.map((entry) => entry.ownerId)).toEqual(["system:reference-image"]);
  });

  it("attaches an existing shared storage instance without forcing reprovisioning", async () => {
    const repository = new InMemoryStorageInstanceMetadataRepository();
    const service = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      repository,
      () => new Date("2026-04-03T00:00:00.000Z"),
    );

    const created = await service.initialize({
      strategy: "provision",
      instanceId: "storage-instance:shared:images",
      owner: {
        ownerKind: "system",
        ownerId: "system:root",
        role: "runtime-io",
      },
      requestedBindings: ["input", "output"],
    });
    expect(created.provisioned).toBeTrue();

    const attached = await service.initialize({
      strategy: "attach",
      attachInstanceId: "storage-instance:shared:images",
      owner: {
        ownerKind: "embedded-subsystem",
        ownerId: "system:root::subsystem:enhance",
        role: "runtime-io",
      },
      requestedBindings: ["input", "output"],
    });

    expect(attached.provisioned).toBeFalse();
    expect(attached.metadata.attachments.map((entry) => entry.ownerKind)).toEqual(["system", "embedded-subsystem"]);
    expect(attached.metadata.attachments.map((entry) => entry.ownerId)).toEqual(["system:root", "system:root::subsystem:enhance"]);
  });

  it("supports sharing one storage instance across multiple top-level systems without duplicate provisioning", async () => {
    const repository = new InMemoryStorageInstanceMetadataRepository();
    const service = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      repository,
      () => new Date("2026-04-03T00:00:00.000Z"),
    );

    const first = await service.initialize({
      strategy: "provision",
      instanceId: "storage-instance:shared:multi-system",
      owner: {
        ownerKind: "system",
        ownerId: "system:a",
        role: "runtime-io",
      },
      requestedBindings: ["input", "output", "intermediate"],
    });
    const second = await service.initialize({
      strategy: "attach",
      attachInstanceId: "storage-instance:shared:multi-system",
      owner: {
        ownerKind: "system",
        ownerId: "system:b",
        role: "runtime-io",
      },
      requestedBindings: ["input", "output"],
    });

    expect(first.provisioned).toBeTrue();
    expect(second.provisioned).toBeFalse();
    expect(second.metadata.attachments.map((entry) => entry.ownerId)).toEqual(["system:a", "system:b"]);
  });

  it("rejects initialization payloads that try to configure storage directories", async () => {
    const service = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      new InMemoryStorageInstanceMetadataRepository(),
    );

    await expect(service.initialize({
      strategy: "provision",
      instanceId: "storage-instance:reference-image:runtime",
      owner: {
        ownerKind: "system",
        ownerId: "system:reference-image",
      },
      requestedBindings: ["input", "output"],
      metadata: {
        execution: {
          inputDirectory: "/tmp/custom-path",
        },
      },
    } as unknown)).rejects.toThrow("Storage path configuration is infrastructure-owned");
  });
});
