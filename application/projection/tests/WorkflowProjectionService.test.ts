import { describe, expect, it } from "bun:test";
import { WorkflowProjectionService } from "../WorkflowProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";

describe("WorkflowProjectionService", () => {
  it("projects workflow to author form", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "hello" })] });
    const schema = new WorkflowProjectionService().projectToForm(makeWorkflow({ id: "wf1", nodes: [node] }));
    expect(schema.sections.length).toBeGreaterThan(0);
    expect(schema.sections[0]?.fields[0]?.id).toBe("n1.p1");
  });
});
