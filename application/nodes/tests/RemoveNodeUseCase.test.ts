import { describe, expect, it } from "bun:test";
import { RemoveNodeUseCase } from "../RemoveNodeUseCase";
import { makeConnection, makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowValidator } from "./testUtils";

describe("RemoveNodeUseCase", () => {
  it("removes node and affected connections", () => {
    const n1 = makeNode({ id: "a" });
    const n2 = makeNode({ id: "b" });
    const workflow = makeWorkflow({ nodes: [n1, n2], connections: [makeConnection("c1", "a", "b")] });

    const result = new RemoveNodeUseCase().execute({ workflow, nodeId: "a" });
    expect(result.removedConnectionIds).toEqual(["c1"]);
    expect(result.workflow.hasNode("a")).toBeFalse();
  });

  it("can validate resulting workflow", () => {
    const node = makeNode({ id: "a" });
    const workflow = makeWorkflow({ nodes: [node] });
    const result = new RemoveNodeUseCase(makeWorkflowValidator()).execute({ workflow, nodeId: "a", validateWorkflow: true });
    expect(result.workflowValidation?.isValid).toBeTrue();
  });
});
