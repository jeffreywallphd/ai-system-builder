import { describe, expect, it } from "bun:test";
import { WorkflowToolProjectionService } from "../WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("WorkflowToolProjectionService", () => {
  it("projects workflow to tool definition", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "hello" })] });
    const workflow = makeWorkflow({ id: "wf1", nodes: [node] }).withMetadata(new WorkflowMetadata({ name: "WF", isPublishedAsTool: true, toolTitle: "Chat" }));
    const tool = new WorkflowToolProjectionService().projectToTool(workflow);
    expect(tool.title).toBe("Chat");
    expect(tool.sections.length).toBeGreaterThan(0);
  });
});
