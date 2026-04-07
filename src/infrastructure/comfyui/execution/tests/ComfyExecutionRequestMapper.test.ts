import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../src/domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../src/domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";
import { ComfyExecutionRequestMapper } from "../mappers/ComfyExecutionRequestMapper";

describe("ComfyExecutionRequestMapper", () => {
  it("maps workflow request and preserves context/runtime parameters", () => {
    const workflow = new Workflow({
      id: "wf",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [makeNode({ id: "n1" })],
    });

    const mapper = new ComfyExecutionRequestMapper({
      workflowAdapter: {
        adaptWorkflowEnvelope: (wf) => ({ prompt: { id: wf.id }, client_id: "wf" }),
      } as never,
    });

    const mapped = mapper.map({
      workflow,
      propertyOverrides: { n1: { required: "updated" } },
      inputAssetRefs: [{ assetId: "asset:1", versionId: "v1" }],
      runtimeParameters: { seed: 42 },
      context: {
        identifiers: { workflowId: workflow.id, executionId: "exec-1" },
        system: { systemAssetRef: "system:abc" },
        datasets: { datasetAssetRefs: ["dataset:1"], datasetInstanceRefs: ["dataset-instance:1"] },
        inputs: { selectedAssetRefs: [{ assetId: "asset:1", versionId: "v1" }] },
        runtime: { parameters: { seed: 42 }, options: { steps: 30 } },
        metadata: { initiatedBy: "test" },
      },
    });

    expect(mapped.payload.client_id).toBe("wf");
    expect(mapped.executionContext.runtime.parameters).toEqual({ seed: 42 });
    expect(mapped.executionContext.runtime.options).toEqual({ steps: 30 });
    expect(mapped.executionContext.inputs.selectedAssetRefs).toHaveLength(1);
    expect(mapped.executionContext.datasets.datasetAssetRefs).toEqual(["dataset:1"]);
  });
});
