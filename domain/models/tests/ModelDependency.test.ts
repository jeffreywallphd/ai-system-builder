import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../ModelCompatibility";
import { ModelDependency } from "../ModelDependency";
import { Model, ModelArtifact, ModelSource } from "../Model";

const makeModel = (overrides: Partial<Model> = {}) =>
  new Model({
    id: "m-1",
    name: "Tokenizer A",
    kind: "tokenizer",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({ name: "tokenizer", accessMethod: "local-file", format: "json" }),
    architectureFamily: "llama",
    precision: "fp16",
    compatibility: new ModelCompatibility({ supportedTasks: ["chat"] }),
    ...overrides,
  });

describe("ModelDependency", () => {
  it("is satisfied when all specified constraints pass", () => {
    const dependency = new ModelDependency({
      id: "d1",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedModelIds: ["M-1"],
      acceptedNames: ["tokenizer a"],
      acceptedKinds: ["tokenizer"],
      acceptedArchitectureFamilies: ["LLAMA"],
      acceptedTasks: ["chat"],
      acceptedFormats: ["json"],
      acceptedPrecisions: ["fp16"],
    });

    expect(dependency.isSatisfiedBy(makeModel())).toBeTrue();
  });

  it("fails when any constraint does not pass", () => {
    const dependency = new ModelDependency({
      id: "d1",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedModelIds: ["other"],
    });

    expect(dependency.isSatisfiedBy(makeModel())).toBeFalse();
  });

  it("matches semantically by type and overlapping constraints", () => {
    const left = new ModelDependency({
      id: "d1",
      label: "Tok",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
      acceptedArchitectureFamilies: ["llama"],
    });

    const right = new ModelDependency({
      id: "d2",
      label: "Tok-2",
      dependencyType: "TOKENIZER",
      acceptedKinds: ["tokenizer"],
      acceptedArchitectureFamilies: ["LLAMA"],
    });

    const mismatch = new ModelDependency({
      id: "d3",
      label: "VAE",
      dependencyType: "vae",
    });

    expect(left.matches(right)).toBeTrue();
    expect(left.matches(mismatch)).toBeFalse();
  });

  it("returns reference key and violation messages", () => {
    const dependency = new ModelDependency({
      id: "d1",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      acceptedKinds: ["tokenizer"],
      acceptedArchitectureFamilies: ["llama"],
      acceptedModelIds: ["m-1"],
    });

    expect(dependency.getReferenceKey()).toContain("tokenizer");
    expect(dependency.getViolationMessage()).toBe("Tokenizer dependency is not satisfied.");

    const described = new ModelDependency({
      id: "d2",
      label: "Tokenizer",
      dependencyType: "tokenizer",
      description: "Need a matching tokenizer",
    });

    expect(described.getViolationMessage()).toBe("Need a matching tokenizer");
  });
});
