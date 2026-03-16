import { describe, expect, it } from "bun:test";
import type { DependencyToken } from "../DependencyContainer";
import { TOKENS } from "../InfrastructureRegistry";

describe("composition contracts", () => {
  it("publishes stable dependency tokens", () => {
    const values = Object.values(TOKENS) as DependencyToken[];
    expect(values.length).toBeGreaterThan(5);
    expect(new Set(values).size).toBe(values.length);
  });
});
