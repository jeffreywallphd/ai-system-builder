import { describe, expect, it } from "bun:test";
import type { ComfyNodeDto } from "../ComfyNodeDto";

describe("ComfyNodeDto", () => {
  it("supports class_type and inputs shape", () => {
    const dto: ComfyNodeDto = { class_type: "KSampler", inputs: { seed: 1 } };
    expect(dto.class_type).toBe("KSampler");
    expect(dto.inputs.seed).toBe(1);
  });
});
