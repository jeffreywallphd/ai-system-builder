import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../src/infrastructure/studio-shell/InMemoryStudioShellRepository";
import { SystemBuildTemplateCatalog } from "../../../../application/system-studio/SystemBuildTemplateCatalog";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Image manipulation default template runnable smoke", () => {
  it("creates a demo-ready seeded system draft that can run output persistence without manual storage setup", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const templateEntry = SystemBuildTemplateCatalog[0]!;

    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: templateEntry.draftSeed.assetId,
      content: templateEntry.draftSeed.contentTemplate,
      metadata: {
        title: templateEntry.draftSeed.metadataPatch.title ?? "Image Manipulation System",
        summary: templateEntry.draftSeed.metadataPatch.summary,
        tags: templateEntry.draftSeed.metadataPatch.tags ?? ["system", "image-manipulation"],
        taxonomy: templateEntry.draftSeed.metadataPatch.taxonomy!,
        provenance: templateEntry.draftSeed.metadataPatch.provenance,
      },
      dependencies: templateEntry.draftSeed.dependencies,
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data!.draft!.draftId;
    const inputUpload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId,
      fileName: "seed-demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(inputUpload.ok).toBeTrue();

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      executionId: "run:smoke:seeded-defaults",
      sourceRecordId: inputUpload.data?.recordId,
      sourceAssetId: inputUpload.data?.image.assetId,
      parameterSnapshot: {
        editInstruction: "Enhance contrast with subtle highlights",
        variationStrength: 0.5,
        resultCount: 1,
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:smoke:seeded-defaults",
                  status: "completed",
                  outputs: [Object.freeze({
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://seeded-smoke-1.png",
                    metadata: Object.freeze({
                      filename: "seeded-smoke-1.png",
                      format: "png",
                      width: 1024,
                      height: 1024,
                    }),
                  })],
                },
              },
            },
          },
        },
      },
    });
    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("materialized");
    expect(persisted.data?.persistedRecordIds).toHaveLength(1);
  });

  it("materializes and runs the default template through storage, dataset, execution, and output retrieval contracts", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const templateEntry = SystemBuildTemplateCatalog[0]!;

    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: templateEntry.draftSeed.assetId,
      content: templateEntry.draftSeed.contentTemplate,
      metadata: {
        title: templateEntry.draftSeed.metadataPatch.title ?? "Image Manipulation System",
        summary: templateEntry.draftSeed.metadataPatch.summary,
        tags: templateEntry.draftSeed.metadataPatch.tags ?? ["system", "image-manipulation"],
        taxonomy: templateEntry.draftSeed.metadataPatch.taxonomy!,
        provenance: templateEntry.draftSeed.metadataPatch.provenance,
      },
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data!.draft!.draftId;
    const runtimeSystemId = `system:studio:${draftId}`;

    const storage = await api.initializeReferenceImageStorage({
      systemId: runtimeSystemId,
      ownerKind: "system",
      ownerRole: "reference-image-runtime",
    });
    expect(storage.ok).toBeTrue();
    const storageInspect = await api.manageReferenceImageStorageLifecycle({
      systemId: runtimeSystemId,
      storageInstanceId: storage.data!.storage.instanceId,
      operation: "inspect",
    });
    expect(storageInspect.ok).toBeTrue();
    expect(storageInspect.data?.datasets.some((entry) => entry.storageBindingAreas.includes("input"))).toBeTrue();
    expect(storageInspect.data?.datasets.some((entry) => entry.storageBindingAreas.includes("output"))).toBeTrue();
    expect(storageInspect.data?.datasets.some((entry) => entry.storageBindingAreas.includes("reference"))).toBeTrue();

    const inputListing = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId,
      datasetBindingId: "input-image-dataset",
      limit: 5,
      offset: 0,
    });
    const outputListingBefore = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId,
      datasetBindingId: "output-image-dataset",
      limit: 5,
      offset: 0,
    });
    const referenceListing = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId,
      datasetBindingId: "reference-image-dataset",
      limit: 5,
      offset: 0,
    });
    expect(inputListing.ok).toBeTrue();
    expect(outputListingBefore.ok).toBeTrue();
    expect(referenceListing.ok).toBeTrue();
    expect(outputListingBefore.data?.summary.totalItems).toBe(0);

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId,
      fileName: "seed.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(upload.ok).toBeTrue();

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      executionId: "run:smoke:default-template",
      sourceRecordId: upload.data?.recordId,
      sourceAssetId: upload.data?.image.assetId,
      parameterSnapshot: {
        editInstruction: "Add warm highlights",
        variationStrength: 0.4,
        resultCount: 1,
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:smoke:default-template",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://generated-smoke-1.png",
                    metadata: {
                      filename: "generated-smoke-1.png",
                      format: "png",
                      width: 800,
                      height: 600,
                    },
                  }],
                },
              },
            },
          },
        },
      },
    });
    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("materialized");
    expect(persisted.data?.persistedRecordIds).toHaveLength(1);

    const outputListingAfter = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      limit: 10,
      offset: 0,
    });
    expect(outputListingAfter.ok).toBeTrue();
    expect(outputListingAfter.data?.summary.totalItems).toBe(1);
    expect(outputListingAfter.data?.summary.datasetAssetId).toBe(
      ReferenceImageSystemTemplate.datasetInstances.find((entry) => entry.bindingId === "output-image-dataset")?.datasetAssetId,
    );

    const persistedRecordId = persisted.data!.persistedRecordIds[0]!;
    const outputItem = await api.getReferenceImageOutput({
      studioId: "studio-system",
      draftId,
      recordId: persistedRecordId,
    });
    expect(outputItem.ok).toBeTrue();
    expect(outputItem.data?.workflow?.workflowRunId).toBe("run:smoke:default-template");
    expect(outputItem.data?.workflow?.workflowAssetId).toBe(
      ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
    );

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-system",
      draftId,
      limit: 10,
      offset: 0,
    });
    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.runId).toBe("run:smoke:default-template");
    expect(history.data?.runs[0]?.workflowAssetId).toBe(
      ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
    );
    expect(history.data?.runs[0]?.lineage?.workflowAssetVersionId).toBe(
      ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
    );
    expect(history.data?.runs[0]?.outputs.datasetInstance?.persistedRecordIds).toEqual(
      persisted.data?.persistedRecordIds,
    );
  });
});
