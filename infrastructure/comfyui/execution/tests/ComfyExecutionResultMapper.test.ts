import { describe, expect, it } from "bun:test";
import { ComfyExecutionResultMapper } from "../mappers/ComfyExecutionResultMapper";

describe("ComfyExecutionResultMapper", () => {
  it("normalizes completion outputs into adapter-safe output records", () => {
    const mapper = new ComfyExecutionResultMapper();
    const result = mapper.map({
      completion: {
        promptId: "p1",
        messages: ["done"],
        outputs: {
          nodeA: [
            { kind: "image", filename: "x.png", subfolder: "out", type: "output" },
            { kind: "text", text: "hello" },
          ],
        },
      },
      consumedAssetRefs: [{ assetId: "asset:input", versionId: "v1" }],
      executionContext: {
        identifiers: { workflowId: "wf-1" },
        datasets: { datasetAssetRefs: ["asset:dataset:def"], datasetInstanceRefs: ["dataset-instance:runtime:1"] },
        inputs: { selectedAssetRefs: [] },
        runtime: { parameters: {}, options: {} },
      },
    });

    expect(result.outputs).toHaveLength(2);
    expect(result.outputs[0]?.assetRef?.assetId).toBe("asset:workflow-output:comfyui:p1:nodeA:image:0");
    expect(result.outputs[0]?.lineage?.consumedAssetRefs?.[0]?.assetId).toBe("asset:input");
    expect(result.outputs[0]?.metadata?.outputDatasetRefs).toEqual(["asset:dataset:def"]);
    expect(result.outputs[0]?.metadata?.outputDatasetInstanceRefs).toEqual(["dataset-instance:runtime:1"]);
  });
});
