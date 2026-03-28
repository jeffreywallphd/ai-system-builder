import { describe, expect, it } from "bun:test";
import { BuildIntents } from "../BuildIntentModels";
import { CommandPaletteService, GlobalCommandTrigger } from "../CommandPalette";
import { ROUTE_PATHS } from "../RouteConfig";

describe("CommandPaletteService", () => {
  it("registers bounded intent-first navigation and build commands", () => {
    const service = new CommandPaletteService();
    const model = service.resolveDefaultModel({ pathname: ROUTE_PATHS.build, search: "" });

    expect(model.entries.some((entry) => entry.label === "Go to Build")).toBeTrue();
    expect(model.entries.some((entry) => entry.label === "Go to Explore")).toBeTrue();
    expect(model.entries.some((entry) => entry.label === "Go to Run")).toBeTrue();
    expect(model.entries.some((entry) => entry.action.intent === BuildIntents.createAiAssistant)).toBeTrue();
    expect(model.entries.every((entry) => !entry.label.toLowerCase().includes("studio"))).toBeTrue();
    expect(model.entries.every((entry) => !entry.label.toLowerCase().includes("taxonomy"))).toBeTrue();
  });

  it("filters and scores commands with intent-friendly terms", () => {
    const service = new CommandPaletteService();
    const model = service.resolveModel({ pathname: ROUTE_PATHS.build, search: "" }, { searchText: "explore" });

    expect(model.entries[0]?.label).toBe("Go to Explore");
    expect(model.entries.every((entry) => `${entry.label} ${entry.description}`.toLowerCase().includes("explore") || entry.keywords.some((keyword) => keyword.includes("explore")))).toBeTrue();
  });

  it("adds context asset commands when asset context exists", () => {
    const service = new CommandPaletteService();
    const model = service.resolveDefaultModel({
      pathname: "/studio-shell/registry/assets/asset%3Aworkflow%3A1",
      search: "?assetId=asset:workflow:1",
    });

    const openAsset = model.entries.find((entry) => entry.id === "context:asset:asset:workflow:1");
    expect(openAsset?.action.launchPath).toBe("/studio-shell/registry/assets/asset%3Aworkflow%3A1");
    expect(model.entries.some((entry) => entry.id === "context:asset:return")).toBeTrue();
  });
});

describe("GlobalCommandTrigger", () => {
  it("opens on Cmd/Ctrl + K and ignores modified variants", () => {
    const trigger = new GlobalCommandTrigger();

    expect(trigger.isOpenCommand({ key: "k", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBeTrue();
    expect(trigger.isOpenCommand({ key: "K", metaKey: false, ctrlKey: true, altKey: false, shiftKey: false })).toBeTrue();
    expect(trigger.isOpenCommand({ key: "k", metaKey: true, ctrlKey: false, altKey: true, shiftKey: false })).toBeFalse();
  });
});
