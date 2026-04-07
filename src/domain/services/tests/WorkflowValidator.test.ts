import { describe, expect, it } from "bun:test";
import { WorkflowValidationResult, WorkflowValidator } from "../WorkflowValidator";
import { NodeProperty } from "../../nodes/NodeProperty";
import { makeConnection, makeNode, makeNodePort, makeWorkflow } from "./testUtils";

describe("WorkflowValidator", () => {
  it("does not report an error for an empty workflow canvas", () => {
    const validator = new WorkflowValidator();
    const emptyWorkflow = makeWorkflow({ nodes: [], connections: [] });

    const result = validator.validateWorkflow(emptyWorkflow);

    expect(result.hasMessage("workflow-empty")).toBeFalse();
    expect(result.errors).toHaveLength(0);
    expect(result.isValid).toBeTrue();
  });

  it("validates workflows with global, graph, node and connection level errors", () => {
    const validator = new WorkflowValidator();
    const brokenNode = makeNode({
      id: "a",
      properties: [
        new NodeProperty({
          id: "required",
          name: "Required",
          type: "text",
          value: "",
          constraints: { required: true },
        }),
      ],
      runtimes: ["vllm"],
      executionRuntime: "comfyui",
    });
    const nodeB = makeNode({
      id: "b",
      inputPorts: [makeNodePort({ id: "in", direction: "input", valueTypes: ["image"] })],
      runtimes: ["comfyui"],
    });

    const workflow = makeWorkflow({
      nodes: [brokenNode, nodeB],
      connections: [makeConnection("ab", "a", "b")],
      isEnabled: false,
      executionPolicy: "acyclic-only",
      runtimeProfile: { allowedRuntimes: ["vllm"], preferredRuntime: "vllm" },
    });

    const result = validator.validateWorkflow(workflow, {
      failOnDisabledNodes: true,
      treatWarningsAsErrors: true,
      requireConnectedGraph: true,
      detectUnreachableNodes: true,
      requireEntryNode: true,
      requireExitNode: true,
      runtime: "onnx",
      validateModelCompatibility: true,
    });

    expect(result.hasMessage("workflow-disabled")).toBeTrue();
    expect(result.hasMessage("node-invalid")).toBeTrue();
    expect(result.hasMessage("node-runtime-incompatible")).toBeTrue();
    expect(result.hasMessage("connection-type-incompatible")).toBeTrue();
    expect(result.hasMessage("runtime-not-supported")).toBeTrue();
    expect(result.isValid).toBeFalse();
    expect(result.invalidNodeIds.length).toBeGreaterThan(0);
    expect(result.invalidConnectionIds).toEqual(["ab"]);
  });

  it("validates graph connectivity and detects missing entry/exit nodes", () => {
    const validator = new WorkflowValidator();
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const cyclic = makeWorkflow({
      nodes: [a, b],
      connections: [makeConnection("ab", "a", "b"), makeConnection("ba", "b", "a")],
      executionPolicy: "acyclic-only",
    }).toGraph();

    const graphResult = validator.validateGraph(cyclic, {
      requireConnectedGraph: true,
      detectUnreachableNodes: true,
      requireEntryNode: true,
      requireExitNode: true,
      treatWarningsAsErrors: true,
    });

    expect(graphResult.hasMessage("graph-cycle-detected")).toBeTrue();
    expect(graphResult.hasMessage("graph-missing-entry-node")).toBeTrue();
    expect(graphResult.hasMessage("graph-missing-exit-node")).toBeTrue();
    expect(graphResult.isValid).toBeFalse();
  });

  it("validates individual nodes and connections with context", () => {
    const validator = new WorkflowValidator();
    const source = makeNode({ id: "source", runtimes: ["vllm"], executionRuntime: "vllm" });
    const target = makeNode({
      id: "target",
      inputPorts: [makeNodePort({ id: "in", direction: "input", valueTypes: ["image"] })],
      runtimes: ["comfyui"],
    });
    const workflow = makeWorkflow({ nodes: [source, target], connections: [makeConnection("st", "source", "target")] });
    const graph = workflow.toGraph();

    const nodeResult = validator.validateNode(source, {
      workflow,
      graph,
      options: { runtime: "onnx", failOnDisabledNodes: true },
    });
    expect(nodeResult.hasMessage("node-runtime-incompatible")).toBeTrue();

    const connResult = validator.validateConnection(makeConnection("st", "source", "target"), {
      workflow,
      graph,
      options: { runtime: "onnx", treatWarningsAsErrors: true },
    });
    expect(connResult.invalidConnectionIds).toEqual(["st"]);

    const missingGraphResult = validator.validateConnection(makeConnection("x", "x", "y"));
    expect(missingGraphResult.messages.length).toBe(0);
  });

  it("WorkflowValidationResult partitions messages and honors warning policy", () => {
    const result = new WorkflowValidationResult({
      messages: [
        { code: "custom", severity: "warning", scope: "workflow", message: "warn" },
        { code: "custom", severity: "error", scope: "workflow", message: "err" },
      ],
      invalidNodeIds: ["n1"],
      invalidConnectionIds: ["c1"],
      treatWarningsAsErrors: true,
    });

    expect(result.hasErrors()).toBeTrue();
    expect(result.hasWarnings()).toBeTrue();
    expect(result.hasMessage("custom")).toBeTrue();
    expect(result.isValid).toBeFalse();
  });
});
