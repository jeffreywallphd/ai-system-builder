import { describe, expect, it } from "bun:test";
import { normalizeSystemSettingsModel } from "../SystemSettingsModel";

describe("SystemSettingsModel", () => {
  it("normalizes missing settings to safe defaults", () => {
    const settings = normalizeSystemSettingsModel(undefined);
    expect(settings.systemName).toBe("");
    expect(settings.navigation.mode).toBe("top");
    expect(settings.runtimeBehavior.showHelpTips).toBe(true);
  });

  it("normalizes invalid navigation modes to the default", () => {
    const settings = normalizeSystemSettingsModel({
      systemName: "Test",
      navigation: { mode: "unsupported" },
    });
    expect(settings.navigation.mode).toBe("top");
  });

  it("reconciles navigation structure and default landing page against current pages", () => {
    const settings = normalizeSystemSettingsModel({
      defaultLandingPageId: "missing-page",
      navigation: {
        mode: "side",
        structure: {
          items: [
            { pageId: "page-2", label: "Review", route: "/review", visible: false, placement: "secondary" },
          ],
        },
      },
    }, {
      pages: [
        { pageId: "page-1", title: "Welcome", navigation: { route: "/welcome" } },
        { pageId: "page-2", title: "Review", navigation: { route: "/review" } },
      ],
    });

    expect(settings.defaultLandingPageId).toBe("page-1");
    expect(settings.navigation.structure.items).toHaveLength(2);
    expect(settings.navigation.structure.items[1]).toMatchObject({
      pageId: "page-2",
      label: "Review",
      visible: false,
      placement: "secondary",
    });
  });
});
