import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../../models/ModelCompatibility";
import { ModelDependency } from "../../models/ModelDependency";
import {
  NodeProperty,
  NodePropertyBindingProfile,
  NodePropertyValidationResult,
} from "../NodeProperty";

describe("NodeProperty*", () => {
  it("creates validation result and binding profile with immutable arrays", () => {
    const vr = new NodePropertyValidationResult(false, ["bad"]);
    expect(vr.isValid).toBe(false);
    expect(vr.messages).toEqual(["bad"]);

    const profile = new NodePropertyBindingProfile({
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
    });
    expect(profile.modalities).toEqual(["text"]);
    expect(() => (profile.tasks as string[]).push("x")).toThrow();
  });

  it("withValue returns an immutable copy", () => {
    const property = new NodeProperty({ id: "p", name: "Prompt", type: "text", value: "a", defaultValue: "d" });
    const updated = property.withValue("b");

    expect(property.value).toBe("a");
    expect(updated.value).toBe("b");
    expect(updated.id).toBe("p");
  });

  it("validates required/min/max/length/pattern/allowed/options/file-extension", () => {
    const property = new NodeProperty({
      id: "path",
      name: "Path",
      type: "file",
      value: "invalid.txt",
      constraints: {
        required: true,
        minLength: 20,
        maxLength: 5,
        pattern: "^/data",
        allowedValues: ["/data/file.json"],
        acceptedFileExtensions: [".json"],
      },
      options: [{ label: "JSON", value: "/data/file.json" }],
    });

    const result = property.validate();
    expect(result.isValid).toBe(false);
    expect(result.messages.length).toBeGreaterThanOrEqual(5);
  });

  it("validates numeric constraints", () => {
    const low = new NodeProperty({
      id: "n1",
      name: "N",
      type: "number",
      value: 1,
      constraints: { min: 2 },
    });
    const high = new NodeProperty({
      id: "n2",
      name: "N",
      type: "number",
      value: 9,
      constraints: { max: 8 },
    });

    expect(low.validate().isValid).toBe(false);
    expect(high.validate().isValid).toBe(false);
  });

  it("evaluates emptiness for null/string/array/object", () => {
    expect(new NodeProperty({ id: "a", name: "A", type: "text", value: null }).isEmpty()).toBe(true);
    expect(new NodeProperty({ id: "b", name: "B", type: "text", value: "   " }).isEmpty()).toBe(true);
    expect(new NodeProperty({ id: "c", name: "C", type: "multi-select", value: [] }).isEmpty()).toBe(true);
    expect(new NodeProperty({ id: "d", name: "D", type: "json", value: {} }).isEmpty()).toBe(true);
    expect(new NodeProperty({ id: "e", name: "E", type: "number", value: 0 }).isEmpty()).toBe(false);
  });

  it("detects model-bound properties by type and binding profile", () => {
    const dep = new ModelDependency({ id: "d", label: "D", dependencyType: "tokenizer" });
    const compatibility = new ModelCompatibility({ supportedTasks: ["chat-completion"] });

    expect(new NodeProperty({ id: "m1", name: "M1", type: "model-reference", value: "id" }).isModelBound()).toBe(true);
    expect(new NodeProperty({ id: "m2", name: "M2", type: "model-list", value: [] }).isModelBound()).toBe(true);
    expect(
      new NodeProperty({
        id: "m3",
        name: "M3",
        type: "text",
        value: "x",
        bindingProfile: new NodePropertyBindingProfile({ modelCompatibility: compatibility }),
      }).isModelBound()
    ).toBe(true);
    expect(
      new NodeProperty({
        id: "m4",
        name: "M4",
        type: "text",
        value: "x",
        bindingProfile: new NodePropertyBindingProfile({ dependencyConstraints: [dep] }),
      }).isModelBound()
    ).toBe(true);
    expect(new NodeProperty({ id: "m5", name: "M5", type: "text", value: "x" }).isModelBound()).toBe(false);
  });

  it("stores projection metadata", () => {
    const property = new NodeProperty({
      id: "p",
      name: "Prompt",
      type: "text",
      value: "x",
      projection: { label: "Prompt Label", exposeInTool: true, authorVisibility: "basic" },
    });

    expect(property.projection?.label).toBe("Prompt Label");
    expect(property.withValue("y").projection?.exposeInTool).toBeTrue();
  });

});
