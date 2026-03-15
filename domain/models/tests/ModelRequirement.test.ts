import { describe, expect, it } from "bun:test";
import { ModelDependency } from "../ModelDependency";
import { ModelRequirement } from "../ModelRequirement";

describe("ModelRequirement", () => {
  it("is satisfied when all requirement dimensions match", () => {
    const requiredDependency = new ModelDependency({
      id: "dep",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
    });

    const requirement = new ModelRequirement({
      id: "r1",
      label: "Runner",
      kind: "runtime",
      acceptedInputModalities: ["text"],
      acceptedOutputModalities: ["text"],
      requiredTasks: ["chat"],
      acceptedRuntimes: ["vllm"],
      acceptedArchitectureFamilies: ["llama"],
      acceptedFormats: ["gguf"],
      requiredDependencies: [requiredDependency],
      acceptedQuantizations: ["q4"],
      acceptedLicenses: ["apache-2.0"],
      minimumMemoryBytes: 10,
      maximumMemoryBytes: 100,
    });

    const actualDependency = new ModelDependency({
      id: "dep2",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
    });

    expect(
      requirement.isSatisfiedBy({
        inputModalities: ["TEXT"],
        outputModalities: ["text"],
        tasks: ["chat", "text-generation"],
        runtime: "vllm",
        architectureFamily: "LLAMA",
        format: "gguf",
        dependencies: [actualDependency],
        quantization: "q4",
        license: "Apache-2.0",
        estimatedMemoryBytes: 64,
      })
    ).toBeTrue();
  });

  it("fails when a required dimension does not match", () => {
    const requirement = new ModelRequirement({
      id: "r2",
      label: "Vision",
      kind: "task",
      requiredTasks: ["image-generation"],
    });

    expect(requirement.isSatisfiedBy({ tasks: ["chat"] })).toBeFalse();
  });

  it("returns description-based or default violation message", () => {
    const withDescription = new ModelRequirement({
      id: "r3",
      label: "Custom",
      kind: "format",
      description: "Custom failure",
    });
    expect(withDescription.getViolationMessage()).toBe("Custom failure");

    const defaultMessage = new ModelRequirement({
      id: "r4",
      label: "Default",
      kind: "format",
    });
    expect(defaultMessage.getViolationMessage()).toBe("Default requirement is not satisfied.");
  });
});
