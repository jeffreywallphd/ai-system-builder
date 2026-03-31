import { describe, expect, it } from "bun:test";
import { CommandPaletteService, GlobalCommandTrigger } from "../CommandPalette";
import { ROUTE_PATHS } from "../RouteConfig";

describe("CommandPaletteService", () => {
  it("registers only the bounded top-level command buttons", () => {
    const service = new CommandPaletteService();
    const model = service.resolveDefaultModel({ pathname: ROUTE_PATHS.build, search: "" });

    expect(model.entries).toHaveLength(5);
    expect(model.entries.map((entry) => entry.label)).toEqual(["Build", "Run", "Explore", "Data", "Manage"]);
    expect(model.entries.every((entry) => !entry.label.toLowerCase().includes("studio"))).toBeTrue();
    expect(model.entries.every((entry) => !entry.label.toLowerCase().includes("taxonomy"))).toBeTrue();
  });

  it("filters and scores commands with intent-friendly terms", () => {
    const service = new CommandPaletteService();
    const model = service.resolveModel({ pathname: ROUTE_PATHS.build, search: "" }, { searchText: "explore" });

    expect(model.entries[0]?.label).toBe("Explore");
    expect(model.entries.every((entry) => `${entry.label} ${entry.description}`.toLowerCase().includes("explore") || entry.keywords.some((keyword) => keyword.includes("explore")))).toBeTrue();
  });

  it("routes the Data menu entry to Dataset Studio", () => {
    const service = new CommandPaletteService();
    const model = service.resolveDefaultModel({ pathname: ROUTE_PATHS.build, search: "" });
    const dataEntry = model.entries.find((entry) => entry.label === "Data");

    expect(dataEntry?.action.launchPath).toBe(ROUTE_PATHS.datasetStudio);
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
