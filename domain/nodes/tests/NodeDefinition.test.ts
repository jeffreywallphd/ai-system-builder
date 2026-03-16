import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../../models/ModelCompatibility";
import { ModelDependency } from "../../models/ModelDependency";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../NodePort";
import { NodeProperty } from "../NodeProperty";

describe("NodeDefinition*", () => {
  it("supports task/runtime checks in capability profile", () => {
    const profile = new NodeDefinitionCapabilityProfile({
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
    });

    expect(profile.supportsTask("chat-completion")).toBe(true);
    expect(profile.supportsTask("classification")).toBe(false);
    expect(profile.supportsRuntime("CUDA")).toBe(true);
    expect(profile.supportsRuntime("cpu")).toBe(false);
    expect(new NodeDefinitionCapabilityProfile({ allowsAnyRuntime: true }).supportsRuntime("cpu")).toBe(true);
  });

  it("creates instances with cloned property values and default state", () => {
    const definition = new NodeDefinition({
      id: "def",
      type: "prompt",
      title: "Prompt",
      category: "language",
      properties: [
        new NodeProperty({ id: "p", name: "Prompt", type: "text", value: "old", defaultValue: "default" }),
      ],
    });

    const node = definition.createInstance("node-1");

    expect(node.id).toBe("node-1");
    expect(node.getProperty("p")?.value).toBe("default");
    expect(node.isEnabled).toBe(true);
    expect(node.isCollapsed).toBe(false);
  });

  it("gets properties/ports by id", () => {
    const input = new NodePort({ id: "in", name: "In", direction: "input" });
    const output = new NodePort({ id: "out", name: "Out", direction: "output" });
    const property = new NodeProperty({ id: "prop", name: "Prop", type: "text", value: "x" });
    const definition = new NodeDefinition({
      id: "def",
      type: "t",
      title: "T",
      category: "utility",
      inputPorts: [input],
      outputPorts: [output],
      properties: [property],
    });

    expect(definition.getProperty("prop")).toBe(property);
    expect(definition.getInputPort("in")).toBe(input);
    expect(definition.getOutputPort("out")).toBe(output);
    expect(definition.getOutputPort("missing")).toBeUndefined();
  });

  it("reports model awareness from properties, ports, and capabilities", () => {
    const dep = new ModelDependency({ id: "d", label: "D", dependencyType: "tokenizer" });
    const modelPort = new NodePort({
      id: "m",
      name: "Model",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["model"], dependencyConstraints: [dep] }),
    });

    const propertyAware = new NodeDefinition({
      id: "a",
      type: "t",
      title: "A",
      category: "model",
      properties: [new NodeProperty({ id: "p", name: "P", type: "model-reference", value: "m" })],
    });
    const portAware = new NodeDefinition({
      id: "b",
      type: "t",
      title: "B",
      category: "model",
      inputPorts: [modelPort],
    });
    const capabilityAware = new NodeDefinition({
      id: "c",
      type: "t",
      title: "C",
      category: "model",
      capabilities: new NodeDefinitionCapabilityProfile({ modelCompatibility: ModelCompatibility.any() }),
    });

    expect(propertyAware.isModelAware()).toBe(true);
    expect(portAware.isModelAware()).toBe(true);
    expect(capabilityAware.isModelAware()).toBe(true);
  });
});
