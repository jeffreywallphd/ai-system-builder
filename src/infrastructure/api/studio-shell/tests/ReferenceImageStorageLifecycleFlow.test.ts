import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image storage lifecycle flow", () => {
  it("supports initialize/reset/archive/cleanup operations and enforces safe deletion guardrails", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const runtimeSystemId = `system:studio:${created.data!.draft!.draftId}`;
    const storage = await api.initializeReferenceImageStorage({
      systemId: runtimeSystemId,
      ownerKind: "system",
      ownerRole: "reference-image-runtime",
    });
    expect(storage.ok).toBeTrue();
    expect(storage.data?.storage.bindings.some((binding) => binding.area === "reference")).toBeTrue();
    const instanceId = storage.data!.storage.instanceId;

    for (const operation of ["initialize", "reset", "inspect", "cleanup", "archive"] as const) {
      const result = await api.manageReferenceImageStorageLifecycle({
        systemId: runtimeSystemId,
        storageInstanceId: instanceId,
        operation,
      });
      expect(result.ok).toBeTrue();
      expect(result.data?.storage.instanceId).toBe(instanceId);
    }

    const blockedDelete = await api.deleteReferenceImageStorage({
      systemId: runtimeSystemId,
      storageInstanceId: instanceId,
    });
    expect(blockedDelete.ok).toBeFalse();
    expect(blockedDelete.error?.message).toContain("attachments are present");
  });

  it("keeps shared-storage lifecycle dataset operations scoped to the requested system and reports inspectable dataset summaries", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const initializedA = await api.initializeStudio("studio-system-a", "System Studio");
    const createdA = await api.createDraft({
      studioId: "studio-system-a",
      sessionId: initializedA.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image A",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });
    const runtimeSystemA = `system:studio:${createdA.data!.draft!.draftId}`;
    const storageA = await api.initializeReferenceImageStorage({ systemId: runtimeSystemA });
    expect(storageA.ok).toBeTrue();
    const sharedStorageInstanceId = storageA.data!.storage.instanceId;

    const initializedB = await api.initializeStudio("studio-system-b", "System Studio");
    const createdB = await api.createDraft({
      studioId: "studio-system-b",
      sessionId: initializedB.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image B",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });
    const runtimeSystemB = `system:studio:${createdB.data!.draft!.draftId}`;
    const attachedStorageB = await api.initializeReferenceImageStorage({
      systemId: runtimeSystemB,
      attachToStorageInstanceId: sharedStorageInstanceId,
    });
    expect(attachedStorageB.ok).toBeTrue();

    const uploadedA = await api.ingestReferenceImageUpload({
      studioId: "studio-system-a",
      draftId: createdA.data!.draft!.draftId,
      fileName: "a.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    const uploadedB = await api.ingestReferenceImageUpload({
      studioId: "studio-system-b",
      draftId: createdB.data!.draft!.draftId,
      fileName: "b.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(uploadedA.ok).toBeTrue();
    expect(uploadedB.ok).toBeTrue();

    const resetA = await api.manageReferenceImageStorageLifecycle({
      systemId: runtimeSystemA,
      storageInstanceId: sharedStorageInstanceId,
      operation: "reset",
    });
    expect(resetA.ok).toBeTrue();
    expect(resetA.data?.datasets.some((dataset) => dataset.datasetBindingId === "input-image-dataset")).toBeTrue();
    const inputSummaryAfterReset = resetA.data?.datasets.find((dataset) => dataset.datasetBindingId === "input-image-dataset");
    expect(inputSummaryAfterReset?.imageRecordCount).toBe(0);

    const internalApi = api as unknown as {
      readonly referenceImageDatasets: {
        listImageRecordsForInstance(input: { readonly systemId: string; readonly instanceId: string }): ReadonlyArray<unknown>;
      };
    };
    const recordsAAfterReset = internalApi.referenceImageDatasets.listImageRecordsForInstance({
      systemId: runtimeSystemA,
      instanceId: "dataset-instance:reference-image:input",
    });
    const recordsBAfterReset = internalApi.referenceImageDatasets.listImageRecordsForInstance({
      systemId: runtimeSystemB,
      instanceId: "dataset-instance:reference-image:input",
    });
    expect(recordsAAfterReset.length).toBe(0);
    expect(recordsBAfterReset.length).toBe(1);

    const archiveA = await api.manageReferenceImageStorageLifecycle({
      systemId: runtimeSystemA,
      storageInstanceId: sharedStorageInstanceId,
      operation: "archive",
    });
    expect(archiveA.ok).toBeTrue();
    expect(archiveA.data?.datasets.every((dataset) => dataset.lifecycleStatus === "archived")).toBeTrue();
    expect(archiveA.data?.datasets.every((dataset) => dataset.cleanupStatus === "pending")).toBeTrue();

    const cleanupA = await api.manageReferenceImageStorageLifecycle({
      systemId: runtimeSystemA,
      storageInstanceId: sharedStorageInstanceId,
      operation: "cleanup",
    });
    expect(cleanupA.ok).toBeTrue();
    expect(cleanupA.data?.datasets.every((dataset) => dataset.cleanupStatus === "completed")).toBeTrue();

    const inspectA = await api.manageReferenceImageStorageLifecycle({
      systemId: runtimeSystemA,
      storageInstanceId: sharedStorageInstanceId,
      operation: "inspect",
    });
    expect(inspectA.ok).toBeTrue();
    expect(inspectA.data?.operation).toBe("inspect");
    expect(inspectA.data?.storage.storageInstanceRef.startsWith("storage-instance://")).toBeTrue();
  });

  it("rejects user-supplied storage path configuration on reference-image storage initialization", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system-validation", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system-validation",
      sessionId: initialized.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image validation",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });
    const runtimeSystemId = `system:studio:${created.data!.draft!.draftId}`;

    const rejected = await api.initializeReferenceImageStorage({
      systemId: runtimeSystemId,
      metadata: {
        outputDirectory: "/tmp/user-controlled",
      },
    } as unknown as Parameters<StudioShellBackendApi["initializeReferenceImageStorage"]>[0]);
    expect(rejected.ok).toBeFalse();
    expect(rejected.error?.message).toContain("Storage path configuration is infrastructure-owned");
  });
});
