import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image vertical slice", () => {
  it("supports upload -> run output persistence -> gallery visualization -> recent activity history", async () => {
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

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "seed.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(upload.ok).toBeTrue();

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      executionId: "run:e2e:1",
      sourceRecordId: upload.data?.recordId,
      sourceAssetId: upload.data?.image.assetId,
      parameterSnapshot: {
        editInstruction: "Add warm highlights",
        variationStrength: 0.4,
        resultCount: 1,
      },
      runtimeResult: {
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:e2e:1",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://generated-e2e-1.png",
                    metadata: {
                      filename: "generated-e2e-1.png",
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
    expect(persisted.data?.persistedRecordIds.length).toBe(1);

    const outputs = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      limit: 10,
      offset: 0,
    });
    expect(outputs.ok).toBeTrue();
    expect(outputs.data?.summary.totalItems).toBe(1);
    expect(outputs.data?.items[0]?.workflow?.workflowRunId).toBe("run:e2e:1");

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      limit: 10,
      offset: 0,
    });
    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.runId).toBe("run:e2e:1");
    expect(history.data?.runs[0]?.outputs.datasetInstance?.persistedRecordIds).toEqual(persisted.data?.persistedRecordIds);
    expect(history.data?.runs[0]?.inputs.images[0]?.stableId).toBe(upload.data?.image.assetId);
    expect(history.data?.runs[0]?.lineage?.workflowExecutionId).toBe("run:e2e:1");
    expect(history.data?.runs[0]?.lineage?.outputDatasetInstanceId).toBe("dataset-instance:reference-image:output");
  });

  it("preserves handoff references and run lineage across snapshot reload", async () => {
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
    const draftId = created.data!.draft!.draftId;

    const run1 = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      executionId: "run:reload:1",
      sourceRecordId: "record:seed:1",
      sourceAssetId: "generated-output:upload://seed-1",
      parameterSnapshot: { editInstruction: "contrast boost", variationStrength: 0.5, resultCount: 1 },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{ selectionId: "record:seed:1", imageId: "record:seed:1", assetRef: { assetId: "generated-output:upload://seed-1", recordId: "record:seed:1" }, metadata: { format: "png" } }],
        parameters: { editInstruction: "contrast boost", variationStrength: 0.5, resultCount: 1 },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:reference-image:input",
          datasetAssetId: "asset:dataset:image-reference-input",
          role: "active-input",
          metadata: { schemaIntentId: "media", sampleRecordValue: { assetRef: { assetId: "generated-output:upload://seed-1" } } },
        }, {
          referenceId: "system-output",
          instanceId: "dataset-instance:reference-image:output",
          datasetAssetId: "asset:dataset:image-reference-output",
          role: "system-owned-output",
        }],
        runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: "session:reload:1" },
      },
      runtimeResult: {
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:reload:1",
                  status: "completed",
                  outputs: [{ nodeId: "save_image", kind: "image", reference: "memory://reload-1.png", metadata: { filename: "reload-1.png", format: "png", width: 640, height: 640 } }],
                },
              },
            },
          },
        },
      },
    });
    expect(run1.ok).toBeTrue();
    expect(run1.data?.status).toBe("materialized");

    const reloaded = await api.loadSnapshot("studio-system");
    expect(reloaded.ok).toBeTrue();
    expect(reloaded.data?.draft?.draftId).toBe(draftId);

    const outputs = await api.listReferenceImageOutputs({ studioId: "studio-system", draftId, limit: 10, offset: 0 });
    expect(outputs.ok).toBeTrue();
    expect(outputs.data?.summary.totalItems).toBe(1);
    expect(outputs.data?.items[0]?.sourceImage?.stableId).toBe("generated-output:upload://seed-1");

    const history = await api.listReferenceImageRunHistory({ studioId: "studio-system", draftId, limit: 10, offset: 0 });
    expect(history.ok).toBeTrue();
    expect(history.data?.runs[0]?.runId).toBe("run:reload:1");
    expect(history.data?.runs[0]?.lineage?.status).toBe("complete");
    expect(history.data?.runs[0]?.lineage?.sourceDatasetInstanceId).toBe("dataset-instance:reference-image:input");
    expect(history.data?.runs[0]?.lineage?.outputDatasetInstanceId).toBe("dataset-instance:reference-image:output");
  });
});
