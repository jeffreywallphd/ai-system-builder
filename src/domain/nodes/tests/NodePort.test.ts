import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../../models/ModelCompatibility";
import { ModelDependency } from "../../models/ModelDependency";
import { NodePort, NodePortCompatibilityProfile } from "../NodePort";

describe("NodePort*", () => {
  it("supports value/task/modality/runtime checks", () => {
    const profile = new NodePortCompatibilityProfile({
      valueTypes: ["text"],
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
    });

    expect(profile.supportsValueType("TEXT")).toBe(true);
    expect(profile.supportsModality("TEXT")).toBe(true);
    expect(profile.supportsTask("chat-completion")).toBe(true);
    expect(profile.supportsRuntime("CUDA")).toBe(true);
    expect(profile.supportsRuntime("cpu")).toBe(false);
  });

  it("uses allowsAnyValueType and compatibility constraints", () => {
    const any = new NodePortCompatibilityProfile({ allowsAnyValueType: true });
    expect(any.supportsValueType("embedding")).toBe(true);

    const modelA = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedTasks: ["chat-completion"],
      supportedRuntimes: ["cuda"],
      architectureFamilies: ["llama"],
      compatibleAssetTypes: ["weights"],
    });
    const modelB = ModelCompatibility.from(modelA);
    const depA = new ModelDependency({ id: "a", label: "A", dependencyType: "tokenizer", acceptedKinds: ["llm"] });
    const depB = new ModelDependency({ id: "b", label: "B", dependencyType: "tokenizer", acceptedKinds: ["llm"] });

    const left = new NodePortCompatibilityProfile({ valueTypes: ["model"], modelCompatibility: modelA, dependencyConstraints: [depA] });
    const right = new NodePortCompatibilityProfile({ valueTypes: ["model"], modelCompatibility: modelB, dependencyConstraints: [depB] });
    const mismatch = new NodePortCompatibilityProfile({ valueTypes: ["image"] });

    expect(left.isCompatibleWith(right)).toBe(true);
    expect(left.isCompatibleWith(mismatch)).toBe(false);
  });

  it("canConnectTo validates direction/control/compatibility", () => {
    const output = new NodePort({
      id: "out",
      name: "Out",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    });
    const input = new NodePort({
      id: "in",
      name: "In",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    });
    const sameDirection = new NodePort({ id: "other", name: "Other", direction: "output" });
    const controlMismatch = new NodePort({ id: "ctrl", name: "Ctrl", direction: "input", isControlPort: true });

    expect(output.canConnectTo(input)).toBe(true);
    expect(output.canConnectTo(sameDirection)).toBe(false);
    expect(output.canConnectTo(controlMismatch)).toBe(false);
  });

  it("detects model data and dependency expectations", () => {
    const dep = new ModelDependency({ id: "d", label: "D", dependencyType: "tokenizer" });
    const modelPort = new NodePort({
      id: "m",
      name: "Model",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["model-reference"], dependencyConstraints: [dep] }),
    });
    const genericPort = new NodePort({ id: "g", name: "G", direction: "input" });

    expect(modelPort.carriesModelData()).toBe(true);
    expect(modelPort.expectsDependencies()).toBe(true);
    expect(genericPort.carriesModelData()).toBe(false);
    expect(genericPort.expectsDependencies()).toBe(false);
  });
});
