import { describe, expect, it } from "bun:test";
import type { ComfyPropertyDto } from "../ComfyPropertyDto";

describe("ComfyPropertyDto", () => {
  it("stores name/value pair", () => {
    const dto: ComfyPropertyDto = { name: "steps", value: 20 };
    expect(dto.name).toBe("steps");
    expect(dto.value).toBe(20);
  });
});
