import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages interactions", () => {
  it("keeps placeholder modules consistent for AssetsPage.tsx, ModelsPage.tsx, WorkflowEditorPage.tsx", () => {
    const sources = [readSource("ui/pages/AssetsPage.tsx"), readSource("ui/pages/ModelsPage.tsx"), readSource("ui/pages/WorkflowEditorPage.tsx")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
