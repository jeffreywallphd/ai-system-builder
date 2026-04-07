import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyNodeAdapter } from "../ComfyNodeAdapter";
import { ComfyWorkflowAdapter } from "../ComfyWorkflowAdapter";

describe("adapters interactions", () => {
  it("workflow adapter composes node adapter output", () => {
    const node = makeNode({ id: "n1" });
    const wf = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "WF" }), nodes: [node] });
    const adapter = new ComfyWorkflowAdapter(new ComfyNodeAdapter());
    expect(adapter.adaptWorkflowEnvelope(wf).prompt.n1.class_type).toBe("test");
  });
});
