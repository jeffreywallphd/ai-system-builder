import { describe, expect, it } from "bun:test";
import { MockNodeCatalogProvider } from "../catalog/MockNodeCatalogProvider";

describe("mock catalog interactions", () => {
  it("provides seeded node definitions", async () => {
    const provider = new MockNodeCatalogProvider();

    const definitions = await provider.getAllDefinitions();

    expect(definitions.length).toBeGreaterThan(0);
    expect(
      definitions.some((definition) => definition.id === "PromptText")
    ).toBeTrue();
  });
});
