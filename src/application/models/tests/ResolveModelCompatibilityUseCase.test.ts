import { describe, expect, it } from "bun:test";
import { ResolveModelCompatibilityUseCase } from "../ResolveModelCompatibilityUseCase";
import { makeCompatibility, makeModel, ModelDependency, ModelRequirement } from "@domain/services/tests/testUtils";
import { makeCompatibilityService } from "./testUtils";

describe("ResolveModelCompatibilityUseCase", () => {
  it("routes each mode to compatibility service", () => {
    const service = makeCompatibilityService();
    const useCase = new ResolveModelCompatibilityUseCase(service);
    const model = makeModel("a");
    const profile = makeCompatibility();
    const dep = new ModelDependency({ id: "d", label: "dep", dependencyType: "generic" });
    const req = new ModelRequirement({ id: "r", label: "req", kind: "task" });

    expect(useCase.execute({ mode: "model-to-model", sourceModel: model, targetModel: model }).mode).toBe("model-to-model");
    expect(useCase.execute({ mode: "model-to-profile", model, targetProfile: profile }).mode).toBe("model-to-profile");
    expect(useCase.execute({ mode: "profile-to-profile", sourceProfile: profile, targetProfile: profile }).mode).toBe("profile-to-profile");
    expect(useCase.execute({ mode: "dependency", dependency: dep, model }).mode).toBe("dependency");
    expect(useCase.execute({ mode: "requirement", requirement: req, model }).mode).toBe("requirement");
    expect(useCase.execute({ mode: "readiness", model }).mode).toBe("readiness");
  });

  it("throws on missing required mode params", () => {
    const useCase = new ResolveModelCompatibilityUseCase(makeCompatibilityService());
    expect(() => useCase.execute({ mode: "readiness" })).toThrow("requires model");
  });
});

