import { describe, expect, it } from "bun:test";
import { RecentAndFavoritesService, type RecentAndFavoritesState, type RecentAndFavoritesStore } from "../RecentAndFavorites";

class InMemoryRecentAndFavoritesStore implements RecentAndFavoritesStore {
  public state: RecentAndFavoritesState = Object.freeze({ recents: Object.freeze([]), favorites: Object.freeze([]) });

  load(): RecentAndFavoritesState {
    return this.state;
  }

  save(state: RecentAndFavoritesState): void {
    this.state = state;
  }
}

describe("RecentAndFavoritesService", () => {
  it("records representative recents for assets, build flows, and run contexts", () => {
    const store = new InMemoryRecentAndFavoritesStore();
    const service = new RecentAndFavoritesService(store);

    service.recordRecentAsset({ assetId: "asset:workflow:1", title: "Workflow One", launchPath: "/studio-shell/registry/assets/asset%3Aworkflow%3A1" });
    service.recordRecentBuildFlow({ intent: "automate-task", launchPath: "/build?buildIntent=automate-task" });
    service.recordRecentRunContext({ request: { contextKind: "asset", assetId: "asset:workflow:1", runIntentLabel: "Run here" }, launchPath: "/run?context=asset" });

    const recents = service.listRecents(3);
    expect(recents).toHaveLength(3);
    expect(recents[0]?.subtitle).toBe("Recently used run context");
    expect(recents.some((entry) => entry.title === "Automate a task")).toBeTrue();
    expect(recents.some((entry) => entry.title === "Workflow One")).toBeTrue();
  });

  it("toggles favorites deterministically and resolves reopen actions", () => {
    const store = new InMemoryRecentAndFavoritesStore();
    const service = new RecentAndFavoritesService(store);

    service.toggleFavorite({ itemId: "asset:workflow:1", title: "Workflow One", launchPath: "/studio-shell/registry/assets/asset%3Aworkflow%3A1" });
    expect(service.isFavorite("asset:workflow:1")).toBeTrue();

    const favorite = service.listFavorites()[0];
    expect(service.resolveReopenAction(favorite!)).toBe("/studio-shell/registry/assets/asset%3Aworkflow%3A1");

    service.toggleFavorite({ itemId: "asset:workflow:1", title: "Workflow One", launchPath: "/studio-shell/registry/assets/asset%3Aworkflow%3A1" });
    expect(service.isFavorite("asset:workflow:1")).toBeFalse();
    expect(service.listFavorites()).toHaveLength(0);
  });

  it("keeps labels intent-friendly in user-facing recents", () => {
    const store = new InMemoryRecentAndFavoritesStore();
    const service = new RecentAndFavoritesService(store);

    service.recordRecentBuildFlow({ intent: "create-assistant", launchPath: "/build?buildIntent=create-assistant" });
    const recents = service.listRecents(1);

    expect(recents[0]?.title).toBe("Create an AI assistant");
    expect(recents[0]?.title.toLowerCase().includes("taxonomy")).toBeFalse();
    expect(recents[0]?.title.toLowerCase().includes("composite")).toBeFalse();
  });
});
