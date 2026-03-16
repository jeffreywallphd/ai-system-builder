import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/presenters contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/presenters/AssetPresenter.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/presenters/ModelPresenter.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/presenters/WorkflowPresenter.ts"))).toEqual([]);
  });
});
