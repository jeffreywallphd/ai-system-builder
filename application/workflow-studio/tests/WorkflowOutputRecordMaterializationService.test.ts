import { describe, expect, it } from "bun:test";
import { materializeWorkflowOutputRecords } from "../WorkflowOutputRecordMaterializationService";

describe("materializeWorkflowOutputRecords", () => {
  it("materializes execution outputs into canonical persistable dataset records", () => {
    const result = materializeWorkflowOutputRecords({
      writePlan: [
        {
          bindingId: "binding:images",
          outputId: "images",
          intent: "publish-current-result",
          writeMode: "upsert",
          target: {
            targetType: "output-dataset",
            targetId: "target:output",
            datasetInstanceId: "instance:output",
            datasetAssetId: "asset:dataset:output",
          },
          lineage: {
            workflowAssetId: "asset:workflow:image-edit",
            workflowRunId: "run:1",
            sourceImageStableIds: ["source:1"],
          },
          recordEnvelope: {
            metadata: { bindingScope: "output" },
            defaultTags: ["workflow-output"],
          },
        },
      ],
      workflowRun: {
        runId: "run:1",
        workflowAssetId: "asset:workflow:image-edit",
        workflowAssetVersionId: "asset:workflow:image-edit:v1",
      },
      producedImages: [
        {
          outputId: "images",
          assetRef: {
            kind: "generated-output",
            outputId: "output:1",
            stableId: "generated:1",
          },
          width: 1024,
          height: 768,
          format: "png",
          mimeType: "image/png",
          tags: ["variant"],
          metadata: { seed: 9 },
        },
      ],
      parameterContext: {
        prompt: "enhance detail",
      },
      timestamp: "2026-04-01T00:00:00.000Z",
    });

    expect(result.missingOutputs).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual(expect.objectContaining({
      outputId: "images",
      targetDatasetInstanceId: "instance:output",
      writeMode: "upsert",
      record: expect.objectContaining({
        width: 1024,
        height: 768,
        format: "png",
        tags: ["workflow-output", "variant"],
        metadata: expect.objectContaining({
          runId: "run:1",
          bindingScope: "output",
          seed: 9,
          parameterContext: { prompt: "enhance detail" },
        }),
      }),
      generation: expect.objectContaining({
        runId: "run:1",
        workflowAssetId: "asset:workflow:image-edit",
        outputGroupId: "run:run:1:images",
      }),
    }));
  });

  it("reports outputs from the write plan that did not produce records", () => {
    const result = materializeWorkflowOutputRecords({
      writePlan: [
        {
          bindingId: "binding:images",
          outputId: "images",
          intent: "publish-current-result",
          writeMode: "upsert",
          target: {
            targetType: "output-dataset",
            targetId: "target:output",
            datasetInstanceId: "instance:output",
            datasetAssetId: "asset:dataset:output",
          },
          lineage: {
            workflowAssetId: "asset:workflow:image-edit",
            workflowRunId: "run:1",
            sourceImageStableIds: [],
          },
          recordEnvelope: {
            metadata: {},
            defaultTags: [],
          },
        },
      ],
      workflowRun: {
        runId: "run:1",
        workflowAssetId: "asset:workflow:image-edit",
      },
      producedImages: [],
    });

    expect(result.records).toEqual([]);
    expect(result.missingOutputs).toEqual(["images"]);
  });
});
