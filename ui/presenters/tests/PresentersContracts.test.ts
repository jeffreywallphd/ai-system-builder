import { describe, expect, it } from "bun:test";

import * as AssetPresenterModule from "../AssetPresenter";
import * as ModelPresenterModule from "../ModelPresenter";
import * as NodePresenterModule from "../NodePresenter";
import * as ValidationPresenterModule from "../ValidationPresenter";
import * as WorkflowPresenterModule from "../WorkflowPresenter";

describe("ui/presenters contracts", () => {
  it("exports presenter classes", () => {
    expect(typeof AssetPresenterModule.AssetPresenter).toBe("function");
    expect(typeof ModelPresenterModule.ModelPresenter).toBe("function");
    expect(typeof NodePresenterModule.NodePresenter).toBe("function");
    expect(typeof ValidationPresenterModule.ValidationPresenter).toBe("function");
    expect(typeof WorkflowPresenterModule.WorkflowPresenter).toBe("function");
  });
});
