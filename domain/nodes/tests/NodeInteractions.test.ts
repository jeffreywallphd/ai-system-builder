import { describe, expect, it } from "bun:test";
import { NodeDefinition } from "../NodeDefinition";
import { NodePort } from "../NodePort";
import { NodeProperty } from "../NodeProperty";
import { NodeCompatibilityProfile } from "../NodeCompatibilityProfile";

describe("Node implementation interactions", () => {
  it("NodeDefinition, Node, NodePort, and NodeProperty work together", () => {
    const definition = new NodeDefinition({
      id: "def",
      type: "prompt",
      title: "Prompt",
      category: "input",
      inputPorts: [new NodePort({ id: "in", name: "Input", direction: "input" })],
      outputPorts: [new NodePort({ id: "out", name: "Output", direction: "output" })],
      properties: [new NodeProperty({ id: "text", name: "Text", type: "text", value: "hi" })],
      compatibilityProfile: new NodeCompatibilityProfile({ supportedRuntimes: ["vllm"] }),
    });

    const node = definition.createInstance("n1").withPropertyValue("text", "hello");
    expect(node.definition.type).toBe("prompt");
    expect(node.getOutputPort("out")?.id).toBe("out");
    expect(node.getProperty("text")?.value).toBe("hello");
  });
});
