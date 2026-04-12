import { describe, expect, it } from "bun:test";
import { WorkflowConnection } from "../WorkflowConnection";
import { WorkflowGraph } from "../WorkflowGraph";
import { makeConnection, makeNode } from "./testUtils";

describe("WorkflowGraph", () => {
  it("queries nodes, ports, entry/exit, predecessors/successors and paths", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = makeNode({ id: "c" });
    const disabled = makeConnection("cd", "c", "b").withEnabled(false);

    const graph = new WorkflowGraph({
      nodes: [a, b, c],
      connections: [makeConnection("ab", "a", "b"), makeConnection("bc", "b", "c"), disabled],
    });

    expect(graph.getNode("a")?.id).toBe("a");
    expect(graph.getInboundConnections("b").map((c) => c.id)).toEqual(["ab"]);
    expect(graph.getOutboundConnections("b").map((c) => c.id)).toEqual(["bc"]);
    expect(graph.getInboundConnectionsForPort("b", "in").length).toBe(1);
    expect(graph.getOutboundConnectionsForPort("b", "out").length).toBe(1);
    expect(graph.getPredecessors("c").map((n) => n.id)).toEqual(["b"]);
    expect(graph.getSuccessors("a").map((n) => n.id)).toEqual(["b"]);
    expect(graph.getEntryNodes().map((n) => n.id)).toEqual(["a"]);
    expect(graph.getExitNodes().map((n) => n.id)).toEqual(["c"]);
    expect(graph.hasPath("a", "c")).toBeTrue();
    expect(graph.hasPath("c", "a")).toBeFalse();
    expect(graph.hasPath("a", "a")).toBeTrue();
  });

  it("detects cycles and lists cycle connection ids", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = makeNode({ id: "c" });

    const graph = new WorkflowGraph({
      nodes: [a, b, c],
      connections: [
        makeConnection("ab", "a", "b"),
        makeConnection("bc", "b", "c"),
        makeConnection("ca", "c", "a"),
      ],
    });

    expect(graph.hasCycles()).toBeTrue();
    const cycles = graph.findCycles();
    expect(cycles.length).toBe(1);
    expect(cycles[0].nodeIds).toEqual(["a", "b", "c", "a"]);
    expect(cycles[0].connectionIds).toEqual(["ab", "bc", "ca"]);
  });

  it("topologically sorts and builds execution layers for DAGs", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = makeNode({ id: "c" });
    const d = makeNode({ id: "d" });

    const graph = new WorkflowGraph({
      nodes: [a, b, c, d],
      connections: [
        makeConnection("ab", "a", "b"),
        makeConnection("ac", "a", "c"),
        makeConnection("bd", "b", "d"),
        makeConnection("cd", "c", "d"),
      ],
    });

    expect(graph.topologicalSort().map((n) => n.id)).toEqual(["a", "b", "c", "d"]);

    const layers = graph.buildExecutionLayers();
    expect(layers.map((layer) => layer.index)).toEqual([0, 1, 2]);
    expect(layers[0].nodes.map((n) => n.id)).toEqual(["a"]);
    expect(layers[1].nodes.map((n) => n.id)).toEqual(["b", "c"]);
    expect(layers[2].nodes.map((n) => n.id)).toEqual(["d"]);
  });

  it("throws for topological or layer operations with cycles", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const cyclic = new WorkflowGraph({
      nodes: [a, b],
      connections: [makeConnection("ab", "a", "b"), makeConnection("ba", "b", "a")],
    });

    expect(() => cyclic.topologicalSort()).toThrow();
    expect(() => cyclic.buildExecutionLayers()).toThrow();
  });

  it("validates missing nodes/ports, incompatible ports, cardinality, invalid nodes, and cycles", () => {
    const source = makeNode({ id: "source", outputValueType: "text" });
    const target = makeNode({ id: "target", inputValueType: "number", inputCardinality: "one" });
    const other = makeNode({ id: "other" });
    const invalidNode = makeNode({ id: "invalid", invalidProperty: true });

    const graph = new WorkflowGraph({
      nodes: [source, target, other, invalidNode],
      connections: [
        makeConnection("missing-source", "none", "target"),
        makeConnection("missing-target", "source", "none"),
        makeConnection("bad-source-port", "source", "target", "none", "in"),
        makeConnection("bad-target-port", "source", "target", "out", "none"),
        makeConnection("incompatible", "source", "target"),
        makeConnection("many-1", "source", "other"),
        makeConnection("many-2", "target", "other"),
        makeConnection("cycle-a", "source", "target"),
        makeConnection("cycle-b", "target", "source"),
      ],
    });

    const validation = graph.validate();
    expect(validation.isValid).toBeFalse();
    expect(validation.invalidNodeIds).toContain("invalid");
    expect(validation.invalidConnectionIds).toContain("missing-source");
    expect(validation.invalidConnectionIds).toContain("missing-target");
    expect(validation.invalidConnectionIds).toContain("bad-source-port");
    expect(validation.invalidConnectionIds).toContain("bad-target-port");
    expect(validation.invalidConnectionIds).toContain("incompatible");
    expect(validation.messages.some((m) => m.includes("accepts only one inbound connection"))).toBeTrue();
    expect(validation.messages.some((m) => m.includes("Cycle detected"))).toBeTrue();
  });

  it("deduplicates nodes/connections by id", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c1 = makeConnection("ab", "a", "b");
    const c2 = new WorkflowConnection({
      id: "ab",
      source: { nodeId: "b", portId: "out" },
      target: { nodeId: "a", portId: "in" },
    });

    const graph = new WorkflowGraph({ nodes: [a, b, a], connections: [c1, c2] });
    expect(graph.nodes.length).toBe(2);
    expect(graph.connections.length).toBe(1);
    expect(graph.connections[0].source.nodeId).toBe("b");
  });
});
