import { describe, expect, it } from "../../../../../modules/testing/node-test";

import { desktopPageDefinitions, desktopPageRequiresWorkspace } from "../routes/desktopPages";

describe("desktop page workspace metadata", () => {
  it("marks resource-backed pages as workspace-required and keeps global pages open", () => {
    expect(desktopPageRequiresWorkspace("artifacts")).toBe(true);
    expect(desktopPageRequiresWorkspace("assets")).toBe(true);
    expect(desktopPageRequiresWorkspace("models")).toBe(true);
    expect(desktopPageRequiresWorkspace("image-generation")).toBe(true);
    expect(desktopPageRequiresWorkspace("settings")).toBe(false);
    expect(desktopPageRequiresWorkspace("system")).toBe(false);
    expect(desktopPageDefinitions.filter((page) => page.requiresWorkspace).map((page) => page.key)).toEqual([
      "artifacts",
      "assets",
      "models",
      "image-generation",
    ]);
  });
});
