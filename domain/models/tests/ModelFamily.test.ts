import { describe, expect, it } from "bun:test";
import { ModelFamily } from "../ModelFamily";

describe("ModelFamily", () => {
  it("normalizes aliases and casing in constructor", () => {
    expect(new ModelFamily(" Stable_Diffusion_XL ").value).toBe("sdxl");
    expect(new ModelFamily("Whisper-Large-v3").value).toBe("whisper");
  });

  it("throws on empty normalized value", () => {
    expect(() => new ModelFamily("   ")).toThrow("ModelFamily cannot be empty.");
  });

  it("supports equality and matching across strings and instances", () => {
    const family = new ModelFamily("llama-3.1");
    expect(family.equals("LLAMA")).toBeTrue();
    expect(family.equals(new ModelFamily("llama-2"))).toBeTrue();
    expect(ModelFamily.matches("sd-1.5", "SD15")).toBeTrue();
    expect(ModelFamily.matches(null, "sd15")).toBeFalse();
  });

  it("supports known checks and conversion", () => {
    expect(ModelFamily.isKnown("segment-anything")).toBeTrue();
    expect(ModelFamily.toKnown("segment-anything")).toBe("sam");
    expect(ModelFamily.isKnown("my-custom-family")).toBeFalse();
    expect(ModelFamily.toKnown("my-custom-family")).toBeUndefined();
  });

  it("supports anyOf over aliases", () => {
    const candidates = ["mistral-7b", ModelFamily.LLAMA, "qwen"] as const;
    expect(ModelFamily.anyOf("LLaMA-3", candidates)).toBeTrue();
    expect(ModelFamily.anyOf("phi", candidates)).toBeFalse();
    expect(ModelFamily.anyOf(undefined, candidates)).toBeFalse();
  });

  it("returns stable known values list", () => {
    const values = ModelFamily.values();
    expect(values).toContain("generic");
    expect(values).toContain("sdxl");
    expect(values).toContain("yolo");
    expect(() => (values as string[]).push("bad")).toThrow();
  });
});
