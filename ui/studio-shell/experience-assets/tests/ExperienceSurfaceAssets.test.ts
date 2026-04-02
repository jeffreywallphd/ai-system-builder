import { describe, expect, it } from "bun:test";
import {
  createDefaultExperienceSurfaceAssetRegistry,
  ExperienceSurfaceAssetIds,
  ExperienceSurfaceAssetRegistry,
  resolveExperienceAssetModesFromRegistrations,
} from "../ExperienceSurfaceAssets";

describe("ExperienceSurfaceAssetRegistry", () => {
  it("registers loom wizard and loom canvas experience assets by default", () => {
    const registry = createDefaultExperienceSurfaceAssetRegistry();

    expect(registry.get(ExperienceSurfaceAssetIds.loomWizard)?.modeId).toBe("wizard");
    expect(registry.get(ExperienceSurfaceAssetIds.loomCanvas)?.modeId).toBe("canvas");
    expect(registry.list().map((entry) => entry.id)).toEqual([
      ExperienceSurfaceAssetIds.loomCanvas,
      ExperienceSurfaceAssetIds.loomWizard,
    ]);
  });

  it("resolves configured experience asset ids into mode definitions", () => {
    const modes = resolveExperienceAssetModesFromRegistrations({
      assetIds: [ExperienceSurfaceAssetIds.loomWizard],
    });

    expect(modes).toHaveLength(1);
    expect(modes[0]?.id).toBe("wizard");
    expect(modes[0]?.title).toBe("Wizard");
  });

  it("prevents duplicate registrations", () => {
    const registry = new ExperienceSurfaceAssetRegistry();
    registry.register({
      id: ExperienceSurfaceAssetIds.loomWizard,
      modeId: "wizard",
      title: "Wizard",
      summary: "Guided",
      intent: "guided-authoring",
    });

    expect(() => registry.register({
      id: ExperienceSurfaceAssetIds.loomWizard,
      modeId: "wizard",
      title: "Wizard Duplicate",
      summary: "Guided duplicate",
      intent: "guided-authoring",
    })).toThrow("already registered");
  });
});
