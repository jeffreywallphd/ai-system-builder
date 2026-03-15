import { describe, expect, it } from "bun:test";
import { ConnectionValidationService } from "../ConnectionValidationService";
import { WorkflowGraphService } from "../WorkflowGraphService";
import { WorkflowValidator } from "../WorkflowValidator";
import { makeConnection, makeNode, makeNodePort, makeWorkflow } from "./testUtils";

describe("Service interactions", () => {
  it("aligns connection validation with workflow validation outcomes", () => {
    const connectionService = new ConnectionValidationService();
    const workflowValidator = new WorkflowValidator();

    const source = makeNode({ id: "source" });
    const target = makeNode({
      id: "target",
      inputPorts: [makeNodePort({ id: "in", direction: "input", valueTypes: ["image"] })],
    });
    const connection = makeConnection("st", "source", "target");
    const workflow = makeWorkflow({ nodes: [source, target], connections: [connection] });

    const connectionResult = connectionService.validateConnection(connection, {
      workflow,
      graph: workflow.toGraph(),
      runtime: "vllm",
    });
    const workflowConnectionResult = workflowValidator.validateConnection(connection, {
      workflow,
      graph: workflow.toGraph(),
      options: { runtime: "vllm" },
    });

    expect(connectionResult.isValid).toBeFalse();
    expect(workflowConnectionResult.invalidConnectionIds).toEqual(["st"]);
    expect(connectionResult.hasCode("port-type-incompatible")).toBeTrue();
    expect(workflowConnectionResult.hasMessage("connection-type-incompatible")).toBeTrue();
  });

  it("combines graph planning with validation for cyclic workflows", () => {
    const graphService = new WorkflowGraphService();
    const validator = new WorkflowValidator();

    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const workflow = makeWorkflow({
      nodes: [a, b],
      connections: [makeConnection("ab", "a", "b")],
      executionPolicy: "acyclic-only",
    });

    const cyclicGraph = graphService.createGraphWithConnection(
      workflow.toGraph(),
      makeConnection("ba", "b", "a")
    );
    const plan = graphService.buildExecutionPlan(cyclicGraph);
    const graphValidation = validator.validateGraph(cyclicGraph, {
      requireEntryNode: true,
      requireExitNode: true,
    });

    expect(plan.hasCycles).toBeTrue();
    expect(graphValidation.hasMessage("graph-cycle-detected")).toBeTrue();
    expect(graphService.wouldIntroduceCycle(workflow.toGraph(), "b", "a")).toBeTrue();
  });
});
