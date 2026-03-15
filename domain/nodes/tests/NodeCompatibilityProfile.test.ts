import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../../models/ModelCompatibility";
import { ModelDependency } from "../../models/ModelDependency";
import { NodeCompatibilityProfile } from "../NodeCompatibilityProfile";

describe("NodeCompatibilityProfile", () => {
  it("supports modality/task/runtime with normalization and any flags", () => {
    const profile = new NodeCompatibilityProfile({
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
    });

    expect(profile.supportsModality("TEXT")).toBe(true);
    expect(profile.supportsTask("chat-completion")).toBe(true);
    expect(profile.supportsRuntime("CUDA")).toBe(true);
    expect(profile.supportsRuntime("cpu")).toBe(false);

    const any = NodeCompatibilityProfile.any();
    expect(any.supportsModality("image")).toBe(true);
    expect(any.supportsTask("classification")).toBe(true);
    expect(any.supportsRuntime("webgpu")).toBe(true);
  });

  it("checks compatibility across modality, task and runtime intersections", () => {
    const left = new NodeCompatibilityProfile({
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
    });
    const right = new NodeCompatibilityProfile({
      modalities: ["TEXT"],
      tasks: ["chat-completion"],
      runtimes: ["CUDA"],
    });
    const mismatch = new NodeCompatibilityProfile({
      modalities: ["image"],
      tasks: ["classification"],
      runtimes: ["cpu"],
    });

    expect(left.isCompatibleWith(right)).toBe(true);
    expect(left.isCompatibleWith(mismatch)).toBe(false);
  });

  it("handles modelCompatibility and dependencyConstraints during compatibility checks", () => {
    const compatibleModel = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedTasks: ["chat-completion"],
      supportedRuntimes: ["cuda"],
      architectureFamilies: ["llama"],
      compatibleAssetTypes: ["weights"],
    });
    const incompatibleModel = new ModelCompatibility({
      inputModalities: ["image"],
      outputModalities: ["image"],
      supportedTasks: ["classification"],
      supportedRuntimes: ["cpu"],
      architectureFamilies: ["vit"],
      compatibleAssetTypes: ["vision-weights"],
    });

    const depA = new ModelDependency({ id: "a", label: "A", dependencyType: "tokenizer", acceptedKinds: ["llm"] });
    const depB = new ModelDependency({ id: "b", label: "B", dependencyType: "tokenizer", acceptedKinds: ["llm"] });
    const depC = new ModelDependency({ id: "c", label: "C", dependencyType: "adapter", acceptedKinds: ["diffusion"] });

    const left = new NodeCompatibilityProfile({ modelCompatibility: compatibleModel, dependencyConstraints: [depA] });
    const right = new NodeCompatibilityProfile({ modelCompatibility: compatibleModel, dependencyConstraints: [depB] });
    const bad = new NodeCompatibilityProfile({ modelCompatibility: incompatibleModel, dependencyConstraints: [depC] });

    expect(left.isCompatibleWith(right)).toBe(true);
    expect(left.isCompatibleWith(bad)).toBe(false);
  });

  it("merges profiles and preserves first modelCompatibility", () => {
    const firstModel = ModelCompatibility.any();
    const secondModel = new ModelCompatibility({ supportedTasks: ["classification"] });
    const depA = new ModelDependency({ id: "a", label: "A", dependencyType: "tokenizer" });
    const depB = new ModelDependency({ id: "b", label: "B", dependencyType: "adapter" });

    const left = new NodeCompatibilityProfile({
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
      modelCompatibility: firstModel,
      dependencyConstraints: [depA],
      allowsAnyTask: false,
    });
    const right = new NodeCompatibilityProfile({
      modalities: ["image", "text"],
      tasks: ["classification"],
      runtimes: ["cpu"],
      modelCompatibility: secondModel,
      dependencyConstraints: [depB],
      allowsAnyTask: true,
      allowsAnyRuntime: true,
    });

    const merged = left.merge(right);

    expect(merged.modalities).toEqual(["text", "image"]);
    expect(merged.tasks).toEqual(["chat-completion", "classification"]);
    expect(merged.runtimes).toEqual(["cuda", "cpu"]);
    expect(merged.modelCompatibility).toBe(firstModel);
    expect(merged.dependencyConstraints).toEqual([depA, depB]);
    expect(merged.allowsAnyTask).toBe(true);
    expect(merged.allowsAnyRuntime).toBe(true);
  });

  it("creates an equivalent profile with from", () => {
    const profile = new NodeCompatibilityProfile({
      modalities: ["text"],
      tasks: ["chat-completion"],
      runtimes: ["cuda"],
      allowsAnyRuntime: true,
    });

    const clone = NodeCompatibilityProfile.from(profile);

    expect(clone).not.toBe(profile);
    expect(clone.modalities).toEqual(profile.modalities);
    expect(clone.tasks).toEqual(profile.tasks);
    expect(clone.runtimes).toEqual(profile.runtimes);
    expect(clone.allowsAnyRuntime).toBe(true);
  });
});
