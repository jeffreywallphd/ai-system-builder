import { describe, expect, it } from "bun:test";
import { ModelFamily } from "../ModelFamily";
import { ModelCompatibility } from "../ModelCompatibility";
import { ModelDependency } from "../ModelDependency";
import { Model, ModelArtifact, ModelSource } from "../Model";
import { ModelRequirement } from "../ModelRequirement";
import { ModelTypeHelper } from "../ModelType";

describe("Model interactions", () => {
  it("connects family normalization, model kind typing, dependency and requirement evaluation", () => {
    const architectureFamily = ModelFamily.normalize("LLaMA-3");
    expect(architectureFamily).toBe("llama");
    expect(ModelTypeHelper.isLanguage("chat-model")).toBeTrue();

    const tokenizerDependency = new ModelDependency({
      id: "dep-tokenizer",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
      acceptedArchitectureFamilies: ["llama"],
    });

    const requirement = new ModelRequirement({
      id: "req-runtime",
      label: "Runtime requirement",
      kind: "runtime",
      acceptedRuntimes: ["vllm"],
      requiredDependencies: [tokenizerDependency],
    });

    const tokenizer = new Model({
      id: "tokenizer-1",
      name: "Tok",
      kind: "tokenizer",
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "tok", accessMethod: "local-file", format: "json" }),
      architectureFamily,
      compatibility: new ModelCompatibility({
        inputModalities: ["text"],
        outputModalities: ["text"],
        supportedTasks: ["chat"],
        supportedRuntimes: ["vllm"],
        architectureFamilies: [architectureFamily],
      }),
    });

    const chatModel = new Model({
      id: "chat-1",
      name: "Chat",
      kind: "chat-model",
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "weights", accessMethod: "local-file", format: "gguf" }),
      architectureFamily,
      compatibility: new ModelCompatibility({
        inputModalities: ["text"],
        outputModalities: ["text"],
        supportedTasks: ["chat"],
        supportedRuntimes: ["vllm"],
        architectureFamilies: [architectureFamily],
        compatibleAssetTypes: ["tokenizer"],
      }),
      dependencies: [tokenizerDependency],
      requirements: [requirement],
    });

    expect(chatModel.isCompatibleWith(tokenizer)).toBeTrue();
    expect(chatModel.satisfiesRequirements()).toBeTrue();
  });
});
