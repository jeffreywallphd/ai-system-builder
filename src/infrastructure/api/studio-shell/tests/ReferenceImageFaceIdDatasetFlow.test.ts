import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

const TinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=";

describe("Reference image FaceID dataset flow", () => {
  it("ingests and retrieves optional FaceID reference images through dataset bindings", async () => {
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

    const inputUpload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "input.png",
      mimeType: "image/png",
      payloadBase64: TinyPngBase64,
    });
    expect(inputUpload.ok).toBeTrue();
    expect(inputUpload.data?.datasetBindingId).toBe("input-image-dataset");
    expect(inputUpload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:input");

    const referenceUpload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "face-reference.png",
      mimeType: "image/png",
      payloadBase64: TinyPngBase64,
      targetDatasetBindingId: "reference-image-dataset",
    });
    expect(referenceUpload.ok).toBeTrue();
    expect(referenceUpload.data?.datasetBindingId).toBe("reference-image-dataset");
    expect(referenceUpload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:faceid");

    const listed = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      datasetBindingId: "reference-image-dataset",
      limit: 10,
      offset: 0,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.summary.datasetInstanceId).toBe("dataset-instance:reference-image:faceid");
    expect(listed.data?.summary.totalItems).toBe(1);
    expect(listed.data?.items[0]?.image.recordId).toBe(referenceUpload.data?.recordId);

    const item = await api.getReferenceImageDatasetItem({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      datasetBindingId: "reference-image-dataset",
      recordId: referenceUpload.data!.recordId,
    });
    expect(item.ok).toBeTrue();
    expect(item.data?.image.recordId).toBe(referenceUpload.data?.recordId);
    expect(item.data?.dataset.instanceId).toBe("dataset-instance:reference-image:faceid");
  });

  it("chains persisted output records into the input dataset through dataset bindings", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system-chain", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system-chain",
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
    const draftId = created.data!.draft!.draftId;
    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system-chain",
      draftId,
      executionId: "run:chain:1",
      sourceAssetId: "generated-output:upload://source.png",
      parameterSnapshot: { editInstruction: "chain test", variationStrength: 0.3, resultCount: 1 },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
        parameters: { editInstruction: "chain test", variationStrength: 0.3, resultCount: 1 },
        datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
        runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: "session:test:chain" },
      },
      workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
      workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
      systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      runtimeResult: {
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:chain:1",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://generated-chain-1.png",
                    metadata: {
                      filename: "generated-chain-1.png",
                      format: "png",
                      width: 1024,
                      height: 768,
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
    const sourceRecordId = persisted.data!.persistedRecordIds[0]!;

    const chained = await api.chainReferenceImageDatasetItemToInput({
      studioId: "studio-system-chain",
      draftId,
      sourceDatasetBindingId: "output-image-dataset",
      sourceRecordId,
      targetDatasetBindingId: "input-image-dataset",
    });
    expect(chained.ok).toBeTrue();
    expect(chained.data?.source.recordId).toBe(sourceRecordId);
    expect(chained.data?.target.datasetBindingId).toBe("input-image-dataset");
    expect(chained.data?.target.selectedRecordId).toBe(chained.data?.target.recordId);

    const runtimeSystemId = `system:studio:${draftId}`;
    const inputRecord = (api as unknown as {
      readonly referenceImageDatasets: {
        getImageRecordFromInstance(input: {
          readonly systemId: string;
          readonly instanceId: string;
          readonly recordId: string;
        }): unknown;
      };
    }).referenceImageDatasets.getImageRecordFromInstance({
      systemId: runtimeSystemId,
      instanceId: "dataset-instance:reference-image:input",
      recordId: chained.data!.target.recordId,
    });
    expect(inputRecord).toBeDefined();
  });
});
