import { describe, expect, it } from "bun:test";
import {
  StorageAttachmentOwnerKinds,
  StorageInstanceLifecycleStates,
  createStorageAttachmentId,
  createStorageInstanceMetadata,
  findStorageBindingReference,
} from "../StorageInstanceMetadataModel";

describe("StorageInstanceMetadataModel", () => {
  it("creates compact inspectable metadata for reusable storage instances", () => {
    const metadata = createStorageInstanceMetadata({
      instanceId: "storage-instance:shared-images",
      storageInstanceRef: "storage-instance://storage-instance%3Ashared-images",
      provider: "local-filesystem-storage-instance",
      contractVersion: "1.0.0",
      display: {
        name: "Shared image I/O",
        summary: "Reusable store for input + output images",
        tags: ["images", "shared"],
      },
      lifecycle: {
        state: StorageInstanceLifecycleStates.ready,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      bindings: [{
        bindingId: "storage-binding:storage-instance:shared-images:input",
        area: "input",
        reference: "storage-instance://storage-instance%3Ashared-images/input",
        provider: "local-filesystem-storage-instance",
      }, {
        bindingId: "storage-binding:storage-instance:shared-images:output",
        area: "output",
        reference: "storage-instance://storage-instance%3Ashared-images/output",
        provider: "local-filesystem-storage-instance",
      }],
      shareability: {
        mode: "shared",
        reusable: true,
      },
      attachments: [{
        attachmentId: createStorageAttachmentId({
          instanceId: "storage-instance:shared-images",
          ownerKind: StorageAttachmentOwnerKinds.system,
          ownerId: "system:reference-image",
          role: "runtime-io",
        }),
        ownerKind: StorageAttachmentOwnerKinds.system,
        ownerId: "system:reference-image",
        role: "runtime-io",
        attachedAt: "2026-04-03T00:00:00.000Z",
      }],
      metadata: {
        intent: "image-manipulation",
      },
    });

    expect(metadata.attachments.length).toBe(1);
    expect(findStorageBindingReference(metadata, "output")).toBe("storage-instance://storage-instance%3Ashared-images/output");
  });
});
