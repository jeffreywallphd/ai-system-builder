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
});
