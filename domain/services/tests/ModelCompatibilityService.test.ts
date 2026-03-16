import { describe, expect, it } from "bun:test";
import { ModelCompatibilityResult, ModelCompatibilityService } from "../ModelCompatibilityService";
import { makeCompatibility, makeModel, ModelDependency, ModelRequirement } from "./testUtils";

describe("ModelCompatibilityService", () => {
  it("evaluates model-to-model compatibility including availability and architecture mismatches", () => {
    const service = new ModelCompatibilityService();
    const source = makeModel("source", {
      status: "unavailable",
      architectureFamily: "llama",
      compatibility: makeCompatibility({ supportedRuntimes: ["vllm"], architectureFamilies: ["llama"], allowsAnyArchitectureFamily: false }),
    });
    const target = makeModel("target", {
      architectureFamily: "mistral",
      compatibility: makeCompatibility({ supportedRuntimes: ["transformers"], architectureFamilies: ["mistral"], allowsAnyArchitectureFamily: false }),
    });

    const result = service.evaluateModelToModelCompatibility(source, target, {
      requireAvailable: true,
      runtime: "onnx",
      task: "classification",
    });

    expect(result.isCompatible).toBeFalse();
    expect(result.reasons.some((r) => r.code === "availability-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "architecture-family-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "runtime-mismatch")).toBeTrue();
    expect(result.hasIncompatibilities()).toBeTrue();
  });

  it("evaluates profile compatibility and emits warnings for weak overlaps", () => {
    const service = new ModelCompatibilityService();
    const source = makeCompatibility({
      supportedTasks: ["chat"],
      inputModalities: ["text"],
      outputModalities: ["audio"],
      supportedRuntimes: ["vllm"],
      architectureFamilies: ["llama"],
      allowsAnyRuntime: false,
      allowsAnyArchitectureFamily: false,
    });
    const target = makeCompatibility({
      inputModalities: ["image"],
      outputModalities: ["video"],
      supportedTasks: ["classification"],
      supportedRuntimes: ["transformers"],
      architectureFamilies: ["mistral"],
      allowsAnyRuntime: false,
      allowsAnyArchitectureFamily: false,
    });

    const result = service.evaluateProfileToProfileCompatibility(source, target);
    expect(result.isCompatible).toBeFalse();
    expect(result.reasons.some((r) => r.code === "task-mismatch")).toBeTrue();
    expect(result.reasons.some((r) => r.code === "output-modality-mismatch")).toBeTrue();
  });

  it("evaluates dependency, requirement, and readiness checks", () => {
    const service = new ModelCompatibilityService();
    const dependency = new ModelDependency({
      id: "dep-1",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
      severity: "required",
      description: "Tokenizer is required",
    });
    const requirement = new ModelRequirement({
      id: "req-1",
      label: "Runtime",
      kind: "runtime",
      acceptedRuntimes: ["vllm"],
      severity: "required",
      description: "vllm runtime is required",
    });

    const model = makeModel("main", {
      compatibility: makeCompatibility({ supportedRuntimes: ["transformers"], architectureFamilies: ["mistral"], allowsAnyArchitectureFamily: false }),
      dependencies: [dependency],
      requirements: [requirement],
      status: "unavailable",
    });

    const depResult = service.evaluateDependencyCompatibility(dependency, model, {
      runtime: "vllm",
    });
    expect(depResult.reasons.some((r) => r.code === "dependency-mismatch")).toBeTrue();

    const reqResult = service.evaluateRequirementCompatibility(requirement, model, {
      runtime: "transformers",
    });
    expect(reqResult.reasons.some((r) => r.code === "requirement-unsatisfied")).toBeTrue();

    const readiness = service.evaluateModelReadiness(model, {
      requireAvailable: true,
      runtime: "vllm",
      task: "chat",
      inputModality: "image",
      outputModality: "image",
    });
    expect(readiness.hasIncompatibilities()).toBeTrue();
    expect(readiness.reasons.length).toBeGreaterThan(3);
  });

  it("ModelCompatibilityResult computes severity and helper methods", () => {
    const compatible = new ModelCompatibilityResult([]);
    expect(compatible.severity).toBe("compatible");
    expect(compatible.hasWarnings()).toBeFalse();

    const warning = new ModelCompatibilityResult([
      { code: "dependency-mismatch", severity: "warning", message: "warn" },
    ]);
    expect(warning.severity).toBe("warning");
    expect(warning.hasWarnings()).toBeTrue();

    const incompatible = new ModelCompatibilityResult([
      { code: "runtime-mismatch", severity: "incompatible", message: "bad" },
    ]);
    expect(incompatible.severity).toBe("incompatible");
    expect(incompatible.isCompatible).toBeFalse();
  });
});
