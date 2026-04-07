import { describe, expect, it } from "bun:test";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";
import { makeNode } from "@domain/workflows/tests/testUtils";
import { ComfyWorkflowAdapter } from "../adapters/ComfyWorkflowAdapter";
import { ComfyNodeCatalogProvider } from "../catalog/ComfyNodeCatalogProvider";

describe("comfyui cross-subfolder interactions", () => {
  it("uses catalog definitions with adapters in consistent shape", async () => {
    const provider = new ComfyNodeCatalogProvider({ TestNode: { input: { required: { model: ["MODEL"] } }, output: ["IMAGE"] } });
    const definition = await provider.getDefinitionByType("TestNode");
    const node = definition!.createInstance("n1");
    const wf = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [node] });

    const envelope = new ComfyWorkflowAdapter().adaptWorkflowEnvelope(wf);
    expect(envelope.prompt.n1.class_type).toBe("TestNode");
  });
});

