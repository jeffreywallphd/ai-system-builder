import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
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
        systemId: "system:abc",
        runtimeOptions: { steps: 30 },
        metadata: { initiatedBy: "test" },
      },
    });

    expect(mapped.payload.client_id).toBe("wf");
    expect(mapped.executionContext.runtimeOptions).toEqual({ seed: 42, steps: 30 });
    expect((mapped.executionContext.metadata as any).inputAssetRefs).toHaveLength(1);
  });
});
