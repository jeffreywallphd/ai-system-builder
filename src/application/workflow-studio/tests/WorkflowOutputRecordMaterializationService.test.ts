import { describe, expect, it } from "bun:test";
import { WorkflowOutputTargetTypes } from "@domain/workflow-studio/WorkflowOutputBindingDomain";
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
          targetSemantics: {
            comparisonGrouping: "none",
            appendBehavior: "upsert-preferred",
          },
          lineage: {
            workflowAssetId: "asset:workflow:image-edit",
            workflowRunId: "run:1",
            sourceImageStableIds: ["source:1"],
            sourceDatasetAssetId: "asset:dataset:input",
            sourceDatasetAssetVersionId: "v5",
            sourceDatasetInstanceId: "instance:input",
            sourceRecordIds: ["record:input:1"],
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
          lineage: expect.objectContaining({
            workflowAssetId: "asset:workflow:image-edit",
            sourceDatasetAssetId: "asset:dataset:input",
            sourceRecordIds: ["record:input:1"],
            bindingTarget: expect.objectContaining({ targetType: "output-dataset" }),
          }),
        }),
      }),
      generation: expect.objectContaining({
        runId: "run:1",
        workflowAssetId: "asset:workflow:image-edit",
        outputGroupId: "run:run:1:images",
      }),
    }));
  });

  it("uses append-oriented history ids and preserves traceability metadata across runs", () => {
    const writePlan = [
      {
        bindingId: "binding:history",
        outputId: "images",
        intent: "append-run-history",
        writeMode: "append",
        target: {
          targetType: WorkflowOutputTargetTypes.historyDataset,
          targetId: "target:history",
          datasetInstanceId: "instance:history",
          datasetAssetId: "asset:dataset:history",
        },
        targetSemantics: {
          comparisonGrouping: "none",
          appendBehavior: "append-only",
        },
        lineage: {
          workflowAssetId: "asset:workflow:image-edit",
          workflowAssetVersionId: "v2",
          workflowRunId: "run:1",
          sourceImageStableIds: ["source:a"],
          outputRelationship: {
            relationshipType: "workflow-output-history",
            direction: "captured-in-history",
            reusable: true,
            audit: true,
            introspection: true,
            metadata: { lane: "history" },
          },
        },
        recordEnvelope: {
          metadata: { sourceContext: "user-upload" },
          defaultTags: ["history"],
        },
      },
    ] as const;

    const run1 = materializeWorkflowOutputRecords({
      writePlan,
      workflowRun: {
        runId: "run:1",
        workflowAssetId: "asset:workflow:image-edit",
        workflowAssetVersionId: "v2",
      },
      producedImages: [{
        outputId: "images",
        assetRef: { kind: "generated-output", outputId: "output:1", stableId: "generated:1" },
        width: 512,
        height: 512,
        format: "png",
      }],
      parameterContext: { prompt: "vivid" },
      timestamp: "2026-04-01T00:00:00.000Z",
    });

    const run2 = materializeWorkflowOutputRecords({
      writePlan,
      workflowRun: {
        runId: "run:2",
        workflowAssetId: "asset:workflow:image-edit",
        workflowAssetVersionId: "v2",
      },
      producedImages: [{
        outputId: "images",
        assetRef: { kind: "generated-output", outputId: "output:2", stableId: "generated:2" },
        width: 512,
        height: 512,
        format: "png",
      }],
      parameterContext: { prompt: "vivid" },
      timestamp: "2026-04-01T00:01:00.000Z",
    });

    expect(run1.records[0]?.recordId).toBe("history:binding:history:run:1:0");
    expect(run2.records[0]?.recordId).toBe("history:binding:history:run:2:0");
    expect(run1.records[0]?.record.metadata).toEqual(expect.objectContaining({
      historyEntryId: "history:binding:history:run:1:0",
      workflowAssetVersionId: "v2",
      sourceContext: "user-upload",
      parameterContext: { prompt: "vivid" },
    }));
    expect(run1.records[0]?.generation.outputGroupId).toBe("history:run:1:images");
    expect((run1.records[0]?.record.metadata.lineage as Record<string, unknown>).outputRelationship).toEqual(expect.objectContaining({
      relationshipType: "workflow-output-history",
      direction: "captured-in-history",
    }));
    expect(run2.records[0]?.generation.outputGroupId).toBe("history:run:2:images");
  });

  it("materializes comparison outputs into explicit comparison sets and members", () => {
    const result = materializeWorkflowOutputRecords({
      writePlan: [
        {
          bindingId: "binding:comparison",
          outputId: "images",
          intent: "append-comparison-group",
          writeMode: "append",
          target: {
            targetType: WorkflowOutputTargetTypes.comparisonDataset,
            targetId: "target:comparison",
            datasetInstanceId: "instance:comparison",
            datasetAssetId: "asset:dataset:comparison",
            groupBy: "comparison-set:hero-vs-variants",
          },
          targetSemantics: {
            comparisonGrouping: "required",
            appendBehavior: "append-only",
          },
          lineage: {
            workflowAssetId: "asset:workflow:image-edit",
            workflowRunId: "run:7",
            sourceImageStableIds: ["source:a"],
          },
          recordEnvelope: {
            metadata: { comparisonAxis: "style" },
            defaultTags: ["comparison"],
          },
        },
      ],
      workflowRun: {
        runId: "run:7",
        workflowAssetId: "asset:workflow:image-edit",
      },
      producedImages: [
        {
          outputId: "images",
          outputIndex: 0,
          assetRef: { kind: "generated-output", outputId: "output:a", stableId: "generated:a" },
          width: 512,
          height: 512,
          format: "png",
        },
        {
          outputId: "images",
          outputIndex: 1,
          assetRef: { kind: "generated-output", outputId: "output:b", stableId: "generated:b" },
          width: 512,
          height: 512,
          format: "png",
        },
      ],
      timestamp: "2026-04-01T00:00:00.000Z",
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((entry) => entry.generation.outputGroupId)).toEqual([
      "comparison-set:hero-vs-variants",
      "comparison-set:hero-vs-variants",
    ]);
    expect(result.records[0]?.record.metadata).toEqual(expect.objectContaining({
      comparisonSetId: "comparison-set:hero-vs-variants",
      comparisonMemberId: "comparison:binding:comparison:run:7:0",
      comparisonAxis: "style",
      lineage: expect.objectContaining({
        bindingTarget: expect.objectContaining({ targetType: "comparison-dataset" }),
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
          targetSemantics: {
            comparisonGrouping: "none",
            appendBehavior: "upsert-preferred",
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

