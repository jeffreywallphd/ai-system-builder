import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models interactions", () => {
  it("wires model browser composition and page integration", () => {
    const browser = readSource("ui/components/models/ModelBrowser.tsx");
    const page = readSource("ui/pages/ModelsPage.tsx");

    expect(browser).toContain("<ModelSearchBar");
    expect(browser).toContain("<ModelDetailsPanel");
    expect(browser).toContain("<ModelCompatibilityPanel");
    expect(page).toContain("import ModelBrowser");
    expect(page).toContain("onSearch={(value) => {");
    expect(page).toContain("onInspectModel={(modelId) => {");
  });
});
