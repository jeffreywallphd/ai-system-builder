import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../tests/testUtils";

describe("ui/pages unit coverage", () => {
  it("AssetsPage.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/pages/AssetsPage.tsx"));
  it("ModelsPage.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/pages/ModelsPage.tsx"));
  it("WorkflowEditorPage.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/pages/WorkflowEditorPage.tsx"));
});
