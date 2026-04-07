import { describe, expect, it } from "bun:test";
import { Node, NodeValidationResult } from "../Node";
import { NodeDefinition } from "../NodeDefinition";
import { NodeProperty, NodePropertyValidationResult } from "../NodeProperty";
import { NodePort } from "../NodePort";

describe("Node*", () => {
  const baseDefinition = new NodeDefinition({
    id: "def",
    type: "type",
    title: "Title",
    category: "utility",
    executionKind: "source",
    properties: [new NodeProperty({ id: "prop", name: "Prop", type: "text", value: "ok" })],
    inputPorts: [new NodePort({ id: "in", name: "In", direction: "input" })],
    outputPorts: [new NodePort({ id: "out", name: "Out", direction: "output" })],
  });

  it("creates validation result with frozen data", () => {
    const result = new NodeValidationResult({
      isValid: false,
      messages: ["bad"],
      propertyResults: { prop: new NodePropertyValidationResult(false, ["bad"]) },
    });

    expect(result.isValid).toBe(false);
    expect(result.messages).toEqual(["bad"]);
    expect(result.propertyResults.prop.isValid).toBe(false);
  });

  it("gets properties/ports and supports immutable with* updates", () => {
    const node = new Node({
      id: "n",
      definition: baseDefinition,
      title: "t",
      notes: "n",
      position: { x: 1, y: 2 },
      size: { width: 3, height: 4 },
    });

    expect(node.getProperty("prop")?.value).toBe("ok");
    expect(node.getInputPort("in")?.id).toBe("in");
    expect(node.getOutputPort("out")?.id).toBe("out");

    const updated = node
      .withPropertyValue("prop", "new")
      .withTitle("new-title")
      .withNotes("new-notes")
      .withPosition({ x: 9, y: 10 })
      .withSize({ width: 11, height: 12 })
      .withEnabled(false)
      .withCollapsed(true)
      .withExecutionProfile({ runtime: "cuda", tasks: ["chat-completion"] });

    expect(updated.getProperty("prop")?.value).toBe("new");
    expect(updated.title).toBe("new-title");
    expect(updated.notes).toBe("new-notes");
    expect(updated.position).toEqual({ x: 9, y: 10 });
    expect(updated.size).toEqual({ width: 11, height: 12 });
    expect(updated.isEnabled).toBe(false);
    expect(updated.isCollapsed).toBe(true);
    expect(updated.executionProfile?.runtime).toBe("cuda");

    expect(node.getProperty("prop")?.value).toBe("ok");
    expect(node.title).toBe("t");
  });

  it("aggregates property validation messages and executability", () => {
    const invalidProp = new NodeProperty({
      id: "required",
      name: "Required",
      type: "text",
      value: "",
      constraints: { required: true },
    });
    const validProp = new NodeProperty({ id: "ok", name: "Ok", type: "text", value: "value" });

    const invalidNode = new Node({
      id: "bad",
      definition: baseDefinition,
      properties: [invalidProp, validProp],
      isEnabled: true,
    });

    const validation = invalidNode.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.messages).toContain("Required is required.");
    expect(validation.propertyResults.required.isValid).toBe(false);
    expect(invalidNode.isExecutable()).toBe(false);

    const disabledNode = new Node({ id: "disabled", definition: baseDefinition, isEnabled: false });
    expect(disabledNode.isExecutable()).toBe(false);
  });

  it("reports model awareness from definition or properties", () => {
    const propertyAwareNode = new Node({
      id: "m",
      definition: baseDefinition,
      properties: [new NodeProperty({ id: "m1", name: "M1", type: "model-reference", value: "model-id" })],
    });

    expect(propertyAwareNode.isModelAware()).toBe(true);
    expect(new Node({ id: "plain", definition: baseDefinition }).isModelAware()).toBe(false);
  });
});
