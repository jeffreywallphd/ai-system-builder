import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages contract adherence", () => {
  it("uses shared ui-page classes across all pages", () => {
    const pages = [
      "ui/pages/HomePage.tsx",
      "ui/pages/WorkflowsPage.tsx",
      "ui/pages/WorkflowEditorPage.tsx",
      "ui/pages/ModelsPage.tsx",
      "ui/pages/ContextPage.tsx",
      "ui/pages/AssetsPage.tsx",
      "ui/pages/McpPage.tsx",
      "ui/pages/SettingsPage.tsx",
      "ui/pages/NotFoundPage.tsx",
    ];

    for (const page of pages) {
      const source = readSource(page);
      expect(source).toContain("ui-page");
    }
  });

  it("keeps shared style definitions implemented", () => {
    const source = readSource("ui/pages/PageStyles.css");

    expect(source).toContain(".page-shell");
    expect(source).toContain(".page-grid--editor");
    expect(source).toContain("@media (max-width: 980px)");
  });
});
