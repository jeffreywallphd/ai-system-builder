import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../tests/testUtils";

describe("ui/presenters unit coverage", () => {
  it("AssetPresenter.ts is currently a placeholder module", () => expectPlaceholderModule("ui/presenters/AssetPresenter.ts"));
  it("ModelPresenter.ts is currently a placeholder module", () => expectPlaceholderModule("ui/presenters/ModelPresenter.ts"));
  it("WorkflowPresenter.ts is currently a placeholder module", () => expectPlaceholderModule("ui/presenters/WorkflowPresenter.ts"));
});
