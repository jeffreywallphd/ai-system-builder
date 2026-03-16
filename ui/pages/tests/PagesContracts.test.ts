import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/pages contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/pages/AssetsPage.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/pages/ModelsPage.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/pages/WorkflowEditorPage.tsx"))).toEqual([]);
  });
});
