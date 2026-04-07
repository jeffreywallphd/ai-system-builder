import { describe, expect, it } from "bun:test";
import {
  DeterministicStorageInstanceProvisioner,
  InMemoryStorageInstanceMetadataRepository,
  StorageInstanceInitializationService,
} from "../StorageInstanceInitializationService";
import { StorageInstanceLifecycleService } from "../StorageInstanceLifecycleService";

describe("StorageInstanceLifecycleService", () => {
  it("initializes, resets, archives, and cleans up a storage instance lifecycle state", async () => {
    const metadataRepository = new InMemoryStorageInstanceMetadataRepository();
    const initialization = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      metadataRepository,
      () => new Date("2026-04-03T00:00:00.000Z"),
    );
    await initialization.initialize({
      strategy: "provision",
      instanceId: "storage-instance:lifecycle:alpha",
      owner: { ownerKind: "system", ownerId: "system:alpha" },
      requestedBindings: ["input", "output", "intermediate"],
    });

    const lifecycle = new StorageInstanceLifecycleService(
      metadataRepository,
      undefined,
      () => new Date("2026-04-03T01:00:00.000Z"),
    );
    const initialized = await lifecycle.initialize("storage-instance:lifecycle:alpha");
    expect(initialized.lifecycle.state).toBe("ready");

    const reset = await lifecycle.reset("storage-instance:lifecycle:alpha");
    expect(reset.lifecycle.state).toBe("ready");

    const cleanup = await lifecycle.cleanup("storage-instance:lifecycle:alpha");
    expect(cleanup.lifecycle.state).toBe("ready");

    const inspected = await lifecycle.inspect("storage-instance:lifecycle:alpha");
    expect(inspected.instanceId).toBe("storage-instance:lifecycle:alpha");
    expect(inspected.bindings.map((binding) => binding.area)).toEqual(["input", "output", "intermediate"]);

    const archived = await lifecycle.archive("storage-instance:lifecycle:alpha");
    expect(archived.lifecycle.state).toBe("archived");
    expect(archived.lifecycle.archivedAt).toBe("2026-04-03T01:00:00.000Z");
  });

  it("blocks deletion while shared attachments still exist and allows deletion after detach + archive", async () => {
    const metadataRepository = new InMemoryStorageInstanceMetadataRepository();
    const initialization = new StorageInstanceInitializationService(
      new DeterministicStorageInstanceProvisioner(),
      metadataRepository,
      () => new Date("2026-04-03T00:00:00.000Z"),
    );
    await initialization.initialize({
      strategy: "provision",
      instanceId: "storage-instance:lifecycle:shared",
      owner: { ownerKind: "system", ownerId: "system:root", role: "runtime-io" },
      requestedBindings: ["input", "output"],
    });
    await initialization.initialize({
      strategy: "attach",
      attachInstanceId: "storage-instance:lifecycle:shared",
      owner: { ownerKind: "embedded-subsystem", ownerId: "system:root::subsystem:enhance", role: "runtime-io" },
      requestedBindings: ["input", "output"],
    });

    const lifecycle = new StorageInstanceLifecycleService(metadataRepository);
    await expect(lifecycle.safeDelete("storage-instance:lifecycle:shared")).rejects.toThrow("attachments are present");

    await lifecycle.detach({
      instanceId: "storage-instance:lifecycle:shared",
      ownerKind: "embedded-subsystem",
      ownerId: "system:root::subsystem:enhance",
      role: "runtime-io",
    });
    await lifecycle.detach({
      instanceId: "storage-instance:lifecycle:shared",
      ownerKind: "system",
      ownerId: "system:root",
      role: "runtime-io",
    });
    await lifecycle.archive("storage-instance:lifecycle:shared");
    const deleted = await lifecycle.safeDelete("storage-instance:lifecycle:shared");
    expect(deleted.deleted).toBeTrue();
    expect(metadataRepository.getByInstanceId("storage-instance:lifecycle:shared")).toBeUndefined();
  });
});
