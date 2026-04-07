import { describe, expect, it } from "bun:test";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";
import { makeNode } from "@domain/workflows/tests/testUtils";
import { makeAsset } from "../../../assets/tests/testUtils";
import { createComfyExecutionContext } from "../ComfyExecutionContext";

describe("createComfyExecutionContext", () => {
  it("builds a canonical execution context from workflow execution input", () => {
    const workflow = new Workflow({
      id: "wf-1",
      metadata: new WorkflowMetadata({ name: "Workflow" }),
      nodes: [makeNode({ id: "n1" })],
    });

    const inputAsset = makeAsset("asset:1");

    const context = createComfyExecutionContext({
      workflow,
      inputAssets: [inputAsset],
      parameters: { seed: 1 },
      executionMetadata: {
        executionId: "exec-1",
        systemId: "system:1",
        systemRuntimeId: "runtime:gpu",
        workflowVersionId: "workflow-v1",
        datasetAssetRefs: ["dataset:1"],
        datasetInstanceRefs: ["dataset-instance:1"],
        triggerSource: "workflow-studio-manual",
        triggerAction: "run",
        actorId: "user-1",
        runtimeOptions: { steps: 20 },
      },
    });

    expect(context.identifiers.executionId).toBe("exec-1");
    expect(context.identifiers.workflowId).toBe("wf-1");
    expect(context.datasets.datasetAssetRefs).toEqual(["dataset:1"]);
    expect(context.inputs.selectedAssetRefs).toEqual([{ assetId: "asset:1", versionId: undefined }]);
    expect(context.runtime.parameters).toEqual({ seed: 1 });
    expect(context.runtime.options).toEqual({ steps: 20 });
    expect(context.trigger?.source).toBe("workflow-studio-manual");
  });
});

