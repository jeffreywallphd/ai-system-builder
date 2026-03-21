import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ContextPage", () => {
  it("renders reusable instructions tabs and context store actions", () => {
    const source = readSource("ui/pages/ContextPage.tsx");

    expect(source).toContain("Reusable Instructions");
    expect(source).toContain("Find Packs");
    expect(source).toContain("Create Pack");
    expect(source).toContain("ContextPackageEditor");
    expect(source).toContain("contextStore.initialize()");
    expect(source).toContain(".search({ query: searchQuery, tags: parseTags(searchTagsText) })");
    expect(source).toContain("contextStore.createPackage");
    expect(source).toContain("contextStore.updatePackage");
    expect(source).toContain("contextStore.deletePackage");
  });
});
