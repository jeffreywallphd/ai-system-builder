import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../ModelCompatibility";

describe("ModelCompatibility", () => {
  it("supports modality/task/runtime/family/asset checks with normalization", () => {
    const compatibility = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["image"],
      supportedTasks: ["image-generation"],
      supportedRuntimes: ["diffusers"],
      architectureFamilies: ["SDXL"],
      compatibleAssetTypes: ["LoRA"],
    });

    expect(compatibility.supportsInputModality("text")).toBeTrue();
    expect(compatibility.supportsOutputModality("image")).toBeTrue();
    expect(compatibility.supportsTask("image-generation")).toBeTrue();
    expect(compatibility.supportsRuntime("diffusers")).toBeTrue();
    expect(compatibility.supportsArchitectureFamily("sdxl")).toBeTrue();
    expect(compatibility.supportsAssetType("lora")).toBeTrue();
  });

  it("honors allowsAny flags", () => {
    const compatibility = new ModelCompatibility({
      allowsAnyRuntime: true,
      allowsAnyArchitectureFamily: true,
    });

    expect(compatibility.supportsRuntime("onnx")).toBeTrue();
    expect(compatibility.supportsArchitectureFamily("anything")).toBeTrue();
  });

  it("checks inter-compatibility through runtime and architecture plus overlap", () => {
    const a = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["image"],
      supportedTasks: ["image-generation"],
      supportedRuntimes: ["diffusers"],
      architectureFamilies: ["sdxl"],
    });

    const b = new ModelCompatibility({
      inputModalities: ["image"],
      outputModalities: ["image"],
      supportedTasks: ["image-editing"],
      supportedRuntimes: ["diffusers"],
      architectureFamilies: ["sdxl"],
    });

    const c = new ModelCompatibility({
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedTasks: ["chat"],
      supportedRuntimes: ["vllm"],
      architectureFamilies: ["llama"],
    });

    expect(a.isCompatibleWith(b)).toBeTrue();
    expect(a.isCompatibleWith(c)).toBeFalse();
  });

  it("creates any and from variants", () => {
    const any = ModelCompatibility.any();
    expect(any.allowsAnyRuntime).toBeTrue();
    expect(any.supportsRuntime("custom")).toBeTrue();

    const clone = ModelCompatibility.from(any);
    expect(clone).not.toBe(any);
    expect(clone.allowsAnyArchitectureFamily).toBeTrue();
  });
});
