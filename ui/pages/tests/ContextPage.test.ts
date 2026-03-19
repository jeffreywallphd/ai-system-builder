import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ContextPage", () => {
  it("renders context library authoring copy and store actions", () => {
    const source = readSource("ui/pages/ContextPage.tsx");

    expect(source).toContain("Treat context as a reusable authoring asset");
    expect(source).toContain("ContextPackageBrowser");
    expect(source).toContain("contextStore.initialize()");
    expect(source).toContain("contextStore.search");
    expect(source).toContain("contextStore.createPackage");
    expect(source).toContain("contextStore.updatePackage");
    expect(source).toContain("contextStore.deletePackage");
  });
});
