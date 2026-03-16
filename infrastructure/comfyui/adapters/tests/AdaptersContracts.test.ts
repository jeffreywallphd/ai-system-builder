import { describe, expect, it } from "bun:test";
import { ComfyPropertyAdapter } from "../ComfyPropertyAdapter";

describe("adapters contracts", () => {
  it("return frozen adapter DTO objects", () => {
    const out = new ComfyPropertyAdapter().adaptProperties([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});
