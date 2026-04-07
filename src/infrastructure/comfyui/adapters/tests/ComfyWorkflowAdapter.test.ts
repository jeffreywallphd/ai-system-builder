import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../src/domain/workflows/Workflow";
import { WorkflowConnection } from "../../../../src/domain/workflows/WorkflowConnection";
import { WorkflowMetadata } from "../../../../src/domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";
import { ComfyWorkflowAdapter } from "../ComfyWorkflowAdapter";

describe("ComfyWorkflowAdapter", () => {
  it("adapts workflow into prompt graph", () => {
    const a = makeNode({ id: "a", outputPortId: "out" });
    const b = makeNode({ id: "b", inputPortId: "in" });
    const wf = new Workflow({
      id: "wf",
      metadata: new WorkflowMetadata({ name: "WF" }),
      nodes: [a, b],
      connections: [new WorkflowConnection({ id: "c1", source: { nodeId: "a", portId: "out" }, target: { nodeId: "b", portId: "in" } })],
    });

    const adapted = new ComfyWorkflowAdapter().adaptWorkflowEnvelope(wf);
    expect(adapted.client_id).toBe("wf");
    expect(adapted.prompt.b.inputs.in).toEqual(["a", 0]);
  });
});
