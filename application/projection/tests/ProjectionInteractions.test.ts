import { describe, expect, it } from "bun:test";
import { WorkflowProjectionService } from "../WorkflowProjectionService";
import { WorkflowToolProjectionService } from "../WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";

describe("projection interactions", () => {
  it("keeps workflow as source of truth when applying form and tool input", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "old" })] });
    const workflow = makeWorkflow({ id: "wf1", nodes: [node] });
    const formUpdated = new WorkflowProjectionService().applyFormInput(workflow, { "n1.p1": "new" });
    const toolUpdated = new WorkflowToolProjectionService().applyToolInput(formUpdated, { "n1.p1": "newer" });
    expect(toolUpdated.getNode("n1")?.getProperty("p1")?.value).toBe("newer");
  });
});
