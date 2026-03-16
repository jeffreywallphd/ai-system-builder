import { describe, expect, it } from "bun:test";
import { Workflow } from "../Workflow";
import { WorkflowConnection } from "../WorkflowConnection";
import { WorkflowMetadata, WorkflowRuntimeProfile } from "../WorkflowMetadata";
import { WorkflowGraph } from "../WorkflowGraph";
import { makeNode } from "./testUtils";

describe("Workflow class interactions", () => {
  it("uses WorkflowGraph through toGraph and validate", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = new WorkflowConnection({
      id: "ab",
      source: { nodeId: "a", portId: "out" },
      target: { nodeId: "b", portId: "in" },
    });

    const workflow = new Workflow({
      id: "w",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [a, b],
      connections: [c],
    });

    const graph = workflow.toGraph();
    expect(graph).toBeInstanceOf(WorkflowGraph);
    expect(graph.getOutboundConnections("a").map((x) => x.id)).toEqual(["ab"]);
    expect(workflow.validate().isValid).toBeTrue();
  });

  it("uses metadata/runtime wrappers during cloning paths", () => {
    const workflow = new Workflow({
      id: "w",
      metadata: { name: "  name  " },
      runtimeProfile: { preferredRuntime: "ollama", allowedRuntimes: ["ollama"] },
      nodes: [makeNode({ id: "a" })],
    });

    expect(workflow.metadata).toBeInstanceOf(WorkflowMetadata);
    expect(workflow.metadata.name).toBe("name");
    expect(workflow.runtimeProfile).toBeInstanceOf(WorkflowRuntimeProfile);

    const cloned = Workflow.from(workflow);
    expect(cloned.metadata).toBeInstanceOf(WorkflowMetadata);
    expect(cloned.runtimeProfile).toBeInstanceOf(WorkflowRuntimeProfile);
  });
});
