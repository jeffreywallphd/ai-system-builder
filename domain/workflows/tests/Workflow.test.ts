import { describe, expect, it } from "bun:test";
import { Workflow } from "../Workflow";
import { WorkflowMetadata, WorkflowRuntimeProfile } from "../WorkflowMetadata";
import { makeConnection, makeNode } from "./testUtils";

describe("Workflow", () => {
  it("constructs with defaults and deduplicates nodes/connections", () => {
    const nodeA = makeNode({ id: "a" });
    const nodeB = makeNode({ id: "b" });
    const workflow = new Workflow({
      id: " wf ",
      metadata: new WorkflowMetadata({ name: "Name" }),
      nodes: [nodeA, nodeB, nodeA],
      connections: [makeConnection("ab", "a", "b"), makeConnection("ab", "a", "b")],
    });

    expect(workflow.id).toBe("wf");
    expect(workflow.status).toBe("draft");
    expect(workflow.isEnabled).toBeTrue();
    expect(workflow.executionPolicy).toBe("acyclic-only");
    expect(workflow.nodes.length).toBe(2);
    expect(workflow.connections.length).toBe(1);
  });

  it("manages nodes and connections immutably with audit updates", async () => {
    const base = new Workflow({ id: "w", metadata: new WorkflowMetadata({ name: "n" }) });
    const nodeA = makeNode({ id: "a" });
    const nodeB = makeNode({ id: "b" });

    const withA = base.addNode(nodeA);
    expect(withA.hasNode("a")).toBeTrue();
    expect(withA.audit?.updatedAt).toBeDefined();
    expect(() => withA.addNode(nodeA)).toThrow();

    const updatedA = makeNode({ id: "a", inputValueType: "number" });
    const afterUpdate = withA.updateNode(updatedA);
    expect(afterUpdate.getNode("a")?.getInputPort("in")?.compatibility.valueTypes).toEqual(["number"]);
    expect(() => withA.updateNode(nodeB)).toThrow();

    const withB = afterUpdate.addNode(nodeB);
    const conn = makeConnection("ab", "a", "b");
    const withConn = withB.addConnection(conn);
    expect(withConn.hasConnection("ab")).toBeTrue();
    expect(() => withConn.addConnection(conn)).toThrow();

    const disabledConn = conn.withEnabled(false);
    const updatedConn = withConn.updateConnection(disabledConn);
    expect(updatedConn.getConnection("ab")?.isEnabled).toBeFalse();
    expect(() => withConn.updateConnection(makeConnection("missing", "a", "b"))).toThrow();

    const removedConn = updatedConn.removeConnection("ab");
    expect(removedConn.hasConnection("ab")).toBeFalse();

    const unchanged = removedConn.removeConnection("does-not-exist");
    expect(unchanged).toBe(removedConn);

    const removedNode = withConn.removeNode("a");
    expect(removedNode.hasNode("a")).toBeFalse();
    expect(removedNode.connections.length).toBe(0);
  });

  it("supports with* modifiers, graph conversion, and cloning", () => {
    const nodeA = makeNode({ id: "a" });
    const nodeB = makeNode({ id: "b" });
    const workflow = new Workflow({
      id: "w",
      metadata: new WorkflowMetadata({ name: "old" }),
      nodes: [nodeA, nodeB],
      connections: [makeConnection("ab", "a", "b")],
    });

    const updated = workflow
      .withMetadata(new WorkflowMetadata({ name: "new" }))
      .withStatus("ready")
      .withEnabled(false)
      .withRuntimeProfile(new WorkflowRuntimeProfile({ preferredRuntime: "ollama" }))
      .withExecutionPolicy("allow-cycles");

    expect(updated.metadata.name).toBe("new");
    expect(updated.status).toBe("ready");
    expect(updated.isEnabled).toBeFalse();
    expect(updated.runtimeProfile?.preferredRuntime).toBe("ollama");
    expect(updated.executionPolicy).toBe("allow-cycles");
    expect(updated.toGraph().nodes.length).toBe(2);

    const cloned = Workflow.from(updated);
    expect(cloned).not.toBe(updated);
    expect(cloned.id).toBe(updated.id);
  });

  it("validates workflow-level and graph-level rules and executability", () => {
    const source = makeNode({ id: "source" });
    const target = makeNode({ id: "target", inputValueType: "number" });

    const invalidWorkflow = new Workflow({
      id: "w",
      metadata: new WorkflowMetadata({ name: "x" }),
      isEnabled: false,
      runtimeProfile: new WorkflowRuntimeProfile({ preferredRuntime: "vllm", allowedRuntimes: ["vllm"] }),
      nodes: [source, target],
      connections: [
        makeConnection("bad", "source", "target"),
        makeConnection("cycle", "target", "source"),
      ],
    });

    const validation = invalidWorkflow.validate();
    expect(validation.isValid).toBeFalse();
    expect(validation.messages).toContain("[Workflow] Workflow is disabled.");
    expect(validation.messages).toContain("[Workflow] Workflow execution policy does not allow cycles.");
    expect(validation.invalidConnectionIds).toContain("bad");
    expect(invalidWorkflow.isExecutable()).toBeFalse();

    const empty = new Workflow({ id: "empty", metadata: new WorkflowMetadata({ name: "empty" }), nodes: [] });
    expect(empty.validate().messages).toContain("[Workflow] Workflow must contain at least one node.");

    const valid = new Workflow({
      id: "ok",
      metadata: new WorkflowMetadata({ name: "ok" }),
      status: "ready",
      nodes: [source, makeNode({ id: "t2" })],
      connections: [makeConnection("ok-conn", "source", "t2")],
    });
    expect(valid.validate().isValid).toBeTrue();
    expect(valid.isExecutable()).toBeTrue();
    expect(valid.withStatus("archived").isExecutable()).toBeFalse();
  });
});
