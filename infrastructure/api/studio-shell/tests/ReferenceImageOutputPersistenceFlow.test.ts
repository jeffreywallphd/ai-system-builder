import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image output persistence flow", () => {
  it("persists generated workflow outputs into the system-owned output dataset and returns gallery items", async () => {
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

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      executionId: "run:output:1",
      sourceAssetId: "generated-output:upload://source.png",
      parameterSnapshot: {
        editInstruction: "brighten and sharpen",
        variationStrength: 0.45,
        resultCount: 1,
      },
      runtimeResult: {
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:output:1",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://generated-1.png",
                    metadata: {
                      filename: "generated-1.png",
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
    expect(persisted.data?.datasetInstanceId).toBe("dataset-instance:reference-image:output");
    expect(persisted.data?.persistedRecordIds.length).toBe(1);
    expect(persisted.data?.status).toBe("materialized");

    const listed = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      limit: 10,
      offset: 0,
    });

    expect(listed.ok).toBeTrue();
    expect(listed.data?.summary.datasetInstanceId).toBe("dataset-instance:reference-image:output");
    expect(listed.data?.summary.totalItems).toBe(1);
    expect(listed.data?.items[0]?.workflow?.workflowRunId).toBe("run:output:1");
    expect(listed.data?.items[0]?.sourceImage?.stableId).toBe("generated-output:upload://source.png");
    expect(listed.data?.items[0]?.generationParametersSummary.editInstruction).toBe("brighten and sharpen");
  });
});
