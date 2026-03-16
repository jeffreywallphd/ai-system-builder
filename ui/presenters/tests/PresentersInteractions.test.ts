import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/presenters interactions", () => {
  it("keeps placeholder modules consistent for AssetPresenter.ts, ModelPresenter.ts, WorkflowPresenter.ts", () => {
    const sources = [readSource("ui/presenters/AssetPresenter.ts"), readSource("ui/presenters/ModelPresenter.ts"), readSource("ui/presenters/WorkflowPresenter.ts")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
