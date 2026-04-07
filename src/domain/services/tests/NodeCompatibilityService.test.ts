import { describe, expect, it } from "bun:test";
import { NodeCompatibilityResult, NodeCompatibilityService } from "../NodeCompatibilityService";
import {
  makeCompatibility,
  makeConnection,
  makeModel,
  makeModelBoundProperty,
  makeNode,
  makeNodePort,
  ModelDependency,
  NodePropertyBindingProfile,
} from "./testUtils";
import { NodeDefinition } from "../../nodes/NodeDefinition";
import { NodeProperty } from "../../nodes/NodeProperty";

describe("NodeCompatibilityService", () => {
  it("validates port compatibility across direction, value type, modality, task, runtime, model and dependency constraints", () => {
    const service = new NodeCompatibilityService();
    const sourcePort = makeNodePort({
      id: "out",
      direction: "input",
      valueTypes: ["image"],
      modalities: ["image"],
      tasks: ["image-generation"],
      runtimes: ["comfyui"],
      isControlPort: true,
      modelCompatibility: makeCompatibility({ supportedRuntimes: ["comfyui"], inputModalities: ["image"], outputModalities: ["image"] }),
      dependencyConstraints: [
        new ModelDependency({ id: "dep-a", label: "A", dependencyType: "adapter", acceptedKinds: ["adapter"] }),
      ],
    });
    const targetPort = makeNodePort({
      id: "in",
      direction: "output",
      valueTypes: ["text"],
      modalities: ["text"],
      tasks: ["chat"],
      runtimes: ["vllm"],
      isControlPort: false,
      modelCompatibility: makeCompatibility({ supportedRuntimes: ["vllm"], inputModalities: ["text"], outputModalities: ["text"] }),
      dependencyConstraints: [
        new ModelDependency({ id: "dep-b", label: "B", dependencyType: "lora", acceptedKinds: ["lora"] }),
      ],
    });

    const result = service.evaluatePortCompatibility(sourcePort, targetPort, {
      runtime: "onnx",
      task: "classification",
      modality: "audio",
    });

    expect(result.isCompatible).toBeFalse();
    expect(result.reasons.some((r) => r.code === "port-direction-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "port-value-type-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "port-modality-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "port-runtime-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "port-model-compatibility-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "port-dependency-mismatch")).toBeTrue();
  });

  it("validates connection compatibility and missing ports", () => {
    const service = new NodeCompatibilityService();
    const sourceNode = makeNode({ id: "a" });
    const targetNode = makeNode({ id: "b" });

    const missingPortResult = service.evaluateConnectionCompatibility(
      makeConnection("c1", "a", "b", "missing", "in"),
      { sourceNode, targetNode }
    );
    expect(missingPortResult.reasons.some((r) => r.code === "connection-invalid")).toBeTrue();

    const runtimeResult = service.evaluateConnectionCompatibility(
      makeConnection("c2", "a", "b"),
      { sourceNode, targetNode, runtime: "transformers" }
    );
    expect(runtimeResult.isCompatible).toBeTrue();
  });

  it("validates node-to-node, definition, property-model, and node-model compatibility", () => {
    const service = new NodeCompatibilityService();
    const sourceNode = makeNode({
      id: "src",
      outputPorts: [makeNodePort({ id: "out", direction: "output", valueTypes: ["image"] })],
      runtimes: ["comfyui"],
      tasks: ["image-generation"],
    });
    const targetNode = makeNode({
      id: "dst",
      inputPorts: [makeNodePort({ id: "in", direction: "input", valueTypes: ["text"] })],
      runtimes: ["vllm"],
      tasks: ["chat"],
    });

    const nodePair = service.evaluateNodeToNodeCompatibility(sourceNode, targetNode, {
      runtime: "onnx",
      task: "classification",
    });
    expect(nodePair.reasons.length).toBeGreaterThan(0);

    const replacementDefinition = new NodeDefinition({
      id: "def-replace",
      type: "replace",
      title: "Replace",
      category: "utility",
      properties: [new NodeProperty({ id: "different", name: "Different", type: "text", value: "x" })],
    });

    const definitionResult = service.evaluateNodeDefinitionCompatibility(
      makeNode({ id: "node", properties: [new NodeProperty({ id: "legacy", name: "Legacy", type: "text", value: "x" })] }),
      replacementDefinition,
      { runtime: "onnx", task: "classification" }
    );
    expect(definitionResult.reasons.some((r) => r.code === "custom")).toBeTrue();

    const property = makeModelBoundProperty({
      bindingProfile: new NodePropertyBindingProfile({
        modelCompatibility: makeCompatibility({ supportedRuntimes: ["vllm"], inputModalities: ["text"], outputModalities: ["text"] }),
        runtimes: ["vllm"],
        dependencyConstraints: [new ModelDependency({ id: "dep-req", label: "Req", dependencyType: "tokenizer", acceptedKinds: ["tokenizer"] })],
      }),
    });
    const model = makeModel("model", {
      compatibility: makeCompatibility({ supportedRuntimes: ["comfyui"], inputModalities: ["image"], outputModalities: ["image"] }),
    });
    const propResult = service.evaluatePropertyModelCompatibility(property, model, {
      runtime: "onnx",
      task: "classification",
      modality: "audio",
    });
    expect(propResult.reasons.some((r) => r.code === "property-model-compatibility-mismatch")).toBeTrue();
    expect(propResult.reasons.some((r) => r.code === "property-runtime-mismatch")).toBeTrue();

    const nodeModel = service.evaluateNodeModelCompatibility(
      makeNode({
        id: "model-node",
        modelCompatibility: makeCompatibility({ supportedRuntimes: ["vllm"] }),
        executionRuntime: "comfyui",
        executionModelCompatibility: makeCompatibility({ supportedRuntimes: ["comfyui"] }),
      }),
      makeCompatibility({ supportedRuntimes: ["onnx"], architectureFamilies: ["other"] }),
      { runtime: "vllm", task: "chat" }
    );
    expect(nodeModel.reasons.some((r) => r.code === "node-model-compatibility-mismatch")).toBeTrue();
    expect(nodeModel.reasons.some((r) => r.code === "node-runtime-mismatch")).toBeTrue();
  });

  it("NodeCompatibilityResult computes helper state", () => {
    const result = new NodeCompatibilityResult([
      { code: "node-task-mismatch", severity: "warning", message: "warn" },
    ]);
    expect(result.severity).toBe("warning");
    expect(result.hasWarnings()).toBeTrue();
    expect(result.hasIncompatibilities()).toBeFalse();
  });
});
