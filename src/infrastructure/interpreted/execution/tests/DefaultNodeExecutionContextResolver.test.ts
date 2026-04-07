import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../src/domain/workflows/Workflow";
import { WorkflowConnection } from "../../../../src/domain/workflows/WorkflowConnection";
import { WorkflowMetadata } from "../../../../src/domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";
import { DefaultNodeOutputStore } from "../DefaultNodeOutputStore";
import { DefaultNodeExecutionContextResolver } from "../DefaultNodeExecutionContextResolver";

describe("DefaultNodeExecutionContextResolver", () => {
  it("resolves input values from upstream node outputs", () => {
    const n1 = makeNode({ id: "n1" });
    const n2 = makeNode({ id: "n2" });
    const workflow = new Workflow({
      id: "wf",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [n1, n2],
      connections: [new WorkflowConnection({ id: "c1", source: { nodeId: "n1", portId: "out" }, target: { nodeId: "n2", portId: "in" } })],
    });

    const store = new DefaultNodeOutputStore();
    store.setNodeOutput("n1", { out: "hello" });

    const context = new DefaultNodeExecutionContextResolver().resolve({ workflow, node: n2, outputStore: store });
    expect(context.resolvedInputs.in).toBe("hello");
  });
});
