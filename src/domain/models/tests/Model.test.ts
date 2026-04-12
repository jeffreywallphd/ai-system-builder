import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../ModelCompatibility";
import { ModelDependency } from "../ModelDependency";
import { Model, ModelArtifact, ModelIdentity, ModelResourceProfile, ModelSource } from "../Model";
import { ModelRequirement } from "../ModelRequirement";

describe("Model and model primitives", () => {
  it("constructs primitive classes", () => {
    const identity = new ModelIdentity({ id: "id", name: "name", version: "1" });
    const source = new ModelSource({ type: "local", repository: "repo" });
    const artifact = new ModelArtifact({ name: "weights", accessMethod: "local-file" });
    const resource = new ModelResourceProfile({ contextWindowTokens: 4096 });

    expect(identity.id).toBe("id");
    expect(source.type).toBe("local");
    expect(artifact.format).toBe("unknown");
    expect(resource.contextWindowTokens).toBe(4096);
  });

  it("supports status and modality/task checks", () => {
    const model = new Model({
      id: "m",
      name: "Llama",
      kind: "chat-model",
      status: "ready",
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "weights", accessMethod: "local-file", format: "gguf" }),
      compatibility: new ModelCompatibility({
        inputModalities: ["text"],
        outputModalities: ["text"],
        supportedTasks: ["chat"],
      }),
      precision: "q4",
      version: "1",
      variant: "instruct",
    });

    expect(model.isAvailable()).toBeTrue();
    expect(model.isSupportingAsset()).toBeFalse();
    expect(model.supportsTask("chat")).toBeTrue();
    expect(model.supportsInputModality("text")).toBeTrue();
    expect(model.supportsOutputModality("text")).toBeTrue();
    expect(model.toReferenceString()).toBe("Llama@1@instruct@q4");
  });

  it("evaluates compatibility, dependency shortcuts, and requirements", () => {
    const sharedCompatibility = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedTasks: ["chat"],
      supportedRuntimes: ["vllm"],
      architectureFamilies: ["llama"],
      compatibleAssetTypes: ["lora"],
    });

    const dependency = new ModelDependency({
      id: "dep",
      label: "Needs base",
      dependencyType: "chat-model",
      acceptedModelIds: ["base"],
    });

    const requirement = new ModelRequirement({
      id: "req",
      label: "Needs chat",
      kind: "task",
      requiredTasks: ["chat"],
      minimumMemoryBytes: 4,
    });

    const model = new Model({
      id: "adapter",
      name: "Adapter",
      kind: "lora",
      isRunnable: false,
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "adapter", accessMethod: "local-file", format: "safetensors" }),
      compatibility: sharedCompatibility,
      dependencies: [dependency],
      requirements: [requirement],
      resourceProfile: new ModelResourceProfile({ estimatedRecommendedMemoryBytes: 8 }),
      architectureFamily: "llama",
    });

    const base = new Model({
      id: "base",
      name: "Base",
      kind: "chat-model",
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "base", accessMethod: "local-file", format: "gguf" }),
      compatibility: sharedCompatibility,
      architectureFamily: "llama",
    });

    expect(model.isCompatibleWith(base)).toBeTrue();
    expect(model.satisfiesRequirements()).toBeTrue();
  });

  it("clones using from", () => {
    const model = new Model({
      id: "m",
      name: "CloneMe",
      kind: "generic",
      source: new ModelSource({ type: "unknown" }),
      artifact: new ModelArtifact({ name: "x", accessMethod: "unknown" }),
    });

    const cloned = Model.from(model);
    expect(cloned).not.toBe(model);
    expect(cloned.id).toBe(model.id);
    expect(cloned.compatibility).toBe(model.compatibility);
  });
});
