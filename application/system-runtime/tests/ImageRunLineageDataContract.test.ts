import { describe, expect, it } from "bun:test";
import { buildImageRunLineageView } from "../ImageRunLineageDataContract";

describe("ImageRunLineageDataContract", () => {
  it("builds minimal lineage graph from persisted run/output relationships", () => {
    const lineage = buildImageRunLineageView({
      run: {
        runId: "run:lineage:1",
        system: { systemId: "system:image" },
        workflow: { workflowAssetId: "asset:workflow:image", workflowAssetVersionId: "v1" },
        inputs: {
          parameterSummary: {},
          images: [{ stableId: "input:image:1" }],
        },
        outputs: {
          datasetInstance: {
            instanceId: "instance:outputs",
            datasetAssetId: "asset:dataset:outputs",
            role: "system-output",
            persistedRecordIds: ["record:1"],
          },
          images: [{ recordId: "record:1" }],
        },
        status: "completed",
        lineage: {
          status: "complete",
          workflowExecutionId: "exec:run:lineage:1",
          traceId: "trace:lineage:1",
          systemAssetId: "asset:system:reference-image-manipulation",
        },
        timestamps: {
          requestedAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:10.000Z",
        },
      },
      linkedOutputs: [{
        itemId: "item:1",
        image: {
          recordId: "record:1",
          selectionId: "record:1",
          width: 512,
          height: 512,
          format: "png",
        },
        dataset: {
          systemId: "system:image",
          instanceId: "instance:outputs",
          datasetAssetId: "asset:dataset:outputs",
          role: "system-output",
        },
        workflow: {
          workflowRunId: "run:lineage:1",
          workflowAssetId: "asset:workflow:image",
          generationRole: "primary",
        },
        timestamps: {
          admittedAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:10.000Z",
        },
        generationParametersSummary: {},
        imageMetadataSummary: { metadata: {}, hasAnnotations: false, hasDerived: false },
        tags: [],
        derivedAttributes: {},
      }],
    });

    expect(lineage.summary.runId).toBe("run:lineage:1");
    expect(lineage.summary.datasetInstanceId).toBe("instance:outputs");
    expect(lineage.summary.lineageStatus).toBe("complete");
    expect(lineage.summary.traceId).toBe("trace:lineage:1");
    expect(lineage.nodes.some((node) => node.kind === "workflow-run")).toBeTrue();
    expect(lineage.edges.some((edge) => edge.kind === "input-to-run")).toBeTrue();
    expect(lineage.edges.some((edge) => edge.kind === "run-to-output")).toBeTrue();
    expect(lineage.edges.some((edge) => edge.kind === "output-to-dataset")).toBeTrue();
  });
});
