import { describe, expect, it } from "bun:test";
import {
  ConnectionValidationResult,
  ConnectionValidationService,
} from "../ConnectionValidationService";
import { makeConnection, makeNode, makeNodePort, makeWorkflow } from "./testUtils";

describe("ConnectionValidationService", () => {
  it("reports missing nodes and missing ports", () => {
    const service = new ConnectionValidationService();

    const missingNodes = service.validateCandidate(
      { source: { nodeId: "a", portId: "out" }, target: { nodeId: "b", portId: "in" } },
      {}
    );
    expect(missingNodes.hasCode("source-node-missing")).toBeTrue();
    expect(missingNodes.hasCode("target-node-missing")).toBeTrue();

    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const workflow = makeWorkflow({ nodes: [a, b] });
    const missingPorts = service.validateCandidate(
      { source: { nodeId: "a", portId: "missing" }, target: { nodeId: "b", portId: "also-missing" } },
      { workflow }
    );
    expect(missingPorts.hasCode("source-port-missing")).toBeTrue();
    expect(missingPorts.hasCode("target-port-missing")).toBeTrue();
  });

  it("applies basic structure, compatibility and graph constraints", () => {
    const service = new ConnectionValidationService();
    const a = makeNode({
      id: "a",
      inputPorts: [makeNodePort({ id: "in", direction: "input", cardinality: "one" })],
      outputPorts: [makeNodePort({ id: "out", direction: "output", valueTypes: ["text"] })],
    });
    const b = makeNode({
      id: "b",
      inputPorts: [makeNodePort({ id: "in", direction: "input", valueTypes: ["image"], cardinality: "one" })],
      outputPorts: [makeNodePort({ id: "out", direction: "output" })],
    });

    const c1 = makeConnection("c1", "a", "b");
    const c2 = makeConnection("c2", "a", "b");
    const workflow = makeWorkflow({
      nodes: [a, b],
      connections: [c1],
      executionPolicy: "acyclic-only",
    });

    const duplicateAndCardinality = service.validateConnection(c2, {
      workflow,
      graph: workflow.toGraph(),
      enforceCardinality: true,
      allowDuplicateConnections: false,
    });

    expect(duplicateAndCardinality.hasCode("duplicate-connection")).toBeTrue();
    expect(duplicateAndCardinality.hasCode("port-cardinality-exceeded")).toBeTrue();
    expect(duplicateAndCardinality.hasCode("port-type-incompatible")).toBeTrue();

    const selfConnection = service.validateCandidate(
      { source: { nodeId: "a", portId: "out" }, target: { nodeId: "a", portId: "in" } },
      { workflow }
    );
    expect(selfConnection.hasCode("self-connection")).toBeTrue();

    const cyclicWorkflow = makeWorkflow({
      nodes: [a, b],
      connections: [makeConnection("ab", "a", "b")],
      executionPolicy: "acyclic-only",
    });
    const cycleResult = service.validateCandidate(
      { source: { nodeId: "b", portId: "out" }, target: { nodeId: "a", portId: "in" } },
      { workflow: cyclicWorkflow, graph: cyclicWorkflow.toGraph() }
    );
    expect(cycleResult.hasCode("cycle-introduced")).toBeTrue();
    expect(cycleResult.hasCode("workflow-policy-violation")).toBeTrue();

    const disabled = makeConnection("disabled", "a", "b").withEnabled(false);
    const disabledResult = service.validateConnection(disabled, {
      workflow,
      graph: workflow.toGraph(),
    });
    expect(disabledResult.hasCode("connection-disabled")).toBeTrue();
  });

  it("supports canConnect and cycle probing", () => {
    const service = new ConnectionValidationService();
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const workflow = makeWorkflow({ nodes: [a, b], connections: [makeConnection("ab", "a", "b")] });
    const graph = workflow.toGraph();

    expect(service.canConnect(b, b.getOutputPort("out")!, a, a.getInputPort("in")!, { graph })).toBeTrue();
    expect(service.wouldIntroduceCycle(graph, "b", "a")).toBeTrue();
  });

  it("ConnectionValidationResult groups messages", () => {
    const result = new ConnectionValidationResult([
      { code: "duplicate-connection", severity: "error", message: "err" },
      { code: "connection-disabled", severity: "warning", message: "warn" },
    ]);

    expect(result.isValid).toBeFalse();
    expect(result.hasErrors()).toBeTrue();
    expect(result.hasWarnings()).toBeTrue();
  });
});
