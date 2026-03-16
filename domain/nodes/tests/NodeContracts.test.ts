import { describe, expect, it } from "bun:test";
import type { INode, INodeValidationResult } from "../interfaces/INode";
import type {
  INodeDefinition,
  INodeDefinitionCapabilityProfile,
} from "../interfaces/INodeDefinition";
import type { INodePort, INodePortCompatibilityProfile } from "../interfaces/INodePort";
import type {
  INodeProperty,
  INodePropertyBindingProfile,
  INodePropertyValidationResult,
} from "../interfaces/INodeProperty";
import { Node, NodeValidationResult } from "../Node";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../NodePort";
import {
  NodeProperty,
  NodePropertyBindingProfile,
  NodePropertyValidationResult,
} from "../NodeProperty";

describe("Node domain contracts", () => {
  it("concrete implementations satisfy interfaces", () => {
    const propertyValidation: INodePropertyValidationResult = new NodePropertyValidationResult(true);
    const bindingProfile: INodePropertyBindingProfile = new NodePropertyBindingProfile();
    const property: INodeProperty = new NodeProperty({ id: "p", name: "P", type: "text", value: "v", bindingProfile });
    const portCompatibility: INodePortCompatibilityProfile = new NodePortCompatibilityProfile({ valueTypes: ["text"] });
    const port: INodePort = new NodePort({ id: "in", name: "In", direction: "input", compatibility: portCompatibility });
    const capabilities: INodeDefinitionCapabilityProfile = new NodeDefinitionCapabilityProfile();
    const definition: INodeDefinition = new NodeDefinition({
      id: "d",
      type: "t",
      title: "T",
      category: "utility",
      properties: [property],
      inputPorts: [port],
      capabilities,
    });
    const node: INode = new Node({ id: "n", definition });
    const validation: INodeValidationResult = new NodeValidationResult({ isValid: true, propertyResults: { p: propertyValidation } });

    expect(node.id).toBe("n");
    expect(definition.id).toBe("d");
    expect(port.id).toBe("in");
    expect(property.id).toBe("p");
    expect(validation.isValid).toBe(true);
  });
});
