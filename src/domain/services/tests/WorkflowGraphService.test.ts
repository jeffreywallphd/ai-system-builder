import { describe, expect, it } from "bun:test";
import { WorkflowGraphComponent, WorkflowExecutionPlan, WorkflowGraphService } from "../WorkflowGraphService";
import { makeConnection, makeNode, makeWorkflow } from "./testUtils";
import { WorkflowConnection } from "../../workflows/WorkflowConnection";

describe("WorkflowGraphService", () => {
  it("provides graph cloning, reachability, lineage and disconnected components", () => {
    const service = new WorkflowGraphService();
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = makeNode({ id: "c" });
    const d = makeNode({ id: "d" });
    const workflow = makeWorkflow({
      nodes: [a, b, c, d],
      connections: [makeConnection("ab", "a", "b"), makeConnection("bc", "b", "c")],
    });

    const graph = service.fromWorkflow(workflow);
    const clone = service.cloneGraph(graph);
    expect(clone).not.toBe(graph);

    const reachable = service.getReachableNodesFrom(graph, ["a", "missing"]);
    expect(reachable.map((n) => n.id)).toEqual(["a", "b", "c"]);

    expect(service.getAncestors(graph, "c").map((n) => n.id)).toEqual(["b", "a"]);
    expect(service.getDescendants(graph, "a").map((n) => n.id)).toEqual(["b", "c"]);
    expect(service.getUnreachableNodes(graph).map((n) => n.id)).toEqual([]);

    const components = service.getDisconnectedComponents(graph);
    expect(components.length).toBe(2);
    expect(components.some((comp) => comp.nodeIds.includes("d"))).toBeTrue();
    expect(service.getExecutableNodes(graph).length).toBe(4);
  });

  it("supports graph mutation utilities, cycle detection, execution plans and sorting", () => {
    const service = new WorkflowGraphService();
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const c = makeNode({ id: "c" });
    const workflow = makeWorkflow({
      nodes: [a, b, c],
      connections: [makeConnection("ab", "a", "b"), makeConnection("bc", "b", "c")],
      executionPolicy: "allow-cycles",
    });
    const graph = workflow.toGraph();

    expect(service.wouldIntroduceCycle(graph, "c", "a")).toBeTrue();

    const withCycle = service.createGraphWithConnection(graph, makeConnection("ca", "c", "a"));
    expect(withCycle.connections.length).toBe(3);

    const withoutConnection = service.createGraphWithoutConnection(withCycle, "bc");
    expect(withoutConnection.connections.some((c) => c.id === "bc")).toBeFalse();

    const withoutNode = service.createGraphWithoutNode(withCycle, "b");
    expect(withoutNode.nodes.some((n) => n.id === "b")).toBeFalse();

    const plan = service.buildExecutionPlan(withCycle);
    expect(plan.hasCycles).toBeTrue();
    expect(plan.layers.length).toBe(0);

    const acyclicPlan = service.buildExecutionPlan(graph);
    expect(acyclicPlan.hasCycles).toBeFalse();
    expect(acyclicPlan.layers.length).toBeGreaterThan(0);

    expect(() => service.sortNodesForExecution(withCycle)).toThrow();
    expect(service.sortNodesForExecution(graph).length).toBe(3);

    expect(service.findConnectionsBetween(graph, "a", "b").length).toBe(1);
    const dependencyConnection = new WorkflowConnection({
      id: "dep",
      source: { nodeId: "a", portId: "out" },
      target: { nodeId: "c", portId: "in" },
      kind: "dependency",
    });
    const dependencyGraph = service.createGraphWithConnection(graph, dependencyConnection);
    expect(service.getIncomingDependencyNodes(dependencyGraph, "c").map((n) => n.id)).toEqual(["a"]);

    const subgraph = service.getSubgraphForNodes(graph, ["a", "b"]);
    expect(subgraph.nodes.length).toBe(2);
    expect(subgraph.connections.length).toBe(1);
  });

  it("value objects freeze provided collections", () => {
    const plan = new WorkflowExecutionPlan({
      layers: [],
      entryNodes: [],
      exitNodes: [],
      hasCycles: false,
      cycles: [],
    });
    const comp = new WorkflowGraphComponent({ nodeIds: ["a"], connectionIds: ["c"] });

    expect(Object.isFrozen(plan.layers)).toBeTrue();
    expect(Object.isFrozen(comp.nodeIds)).toBeTrue();
  });
});
