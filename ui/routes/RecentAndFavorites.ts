import type { BuildIntent } from "./BuildIntentModels";
import type { RunLaunchRequest } from "./RunInterface";

export const RecentItemTypes = Object.freeze({
  asset: "asset",
  buildFlow: "build-flow",
  runContext: "run-context",
});

export type RecentItemType = typeof RecentItemTypes[keyof typeof RecentItemTypes];

export interface RecentItem {
  readonly id: string;
  readonly type: RecentItemType;
  readonly title: string;
  readonly subtitle?: string;
  readonly launchPath: string;
  readonly recordedAtIso: string;
}

export interface FavoriteItem {
  readonly id: string;
  readonly itemId: string;
  readonly title: string;
  readonly launchPath: string;
  readonly createdAtIso: string;
}

export interface FavoriteToggleRequest {
  readonly itemId: string;
  readonly title: string;
  readonly launchPath: string;
}

export interface RecentAndFavoritesState {
  readonly recents: ReadonlyArray<RecentItem>;
  readonly favorites: ReadonlyArray<FavoriteItem>;
}

export interface RecentAndFavoritesStore {
  load(): RecentAndFavoritesState;
  save(state: RecentAndFavoritesState): void;
}

const storageKey = "ai-loom-studio.intent-recents-favorites";

const defaultState: RecentAndFavoritesState = Object.freeze({
  recents: Object.freeze([]),
  favorites: Object.freeze([]),
});

function toFrozenState(state: RecentAndFavoritesState): RecentAndFavoritesState {
  return Object.freeze({
    recents: Object.freeze(state.recents.map((entry) => Object.freeze({ ...entry }))),
    favorites: Object.freeze(state.favorites.map((entry) => Object.freeze({ ...entry }))),
  });
}

function upsertRecent(recents: ReadonlyArray<RecentItem>, next: RecentItem, maxItems: number): ReadonlyArray<RecentItem> {
  const withoutExisting = recents.filter((entry) => entry.id !== next.id);
  return Object.freeze([next, ...withoutExisting].slice(0, maxItems));
}

export class LocalStorageRecentAndFavoritesStore implements RecentAndFavoritesStore {
  private readonly key: string;
  private readonly storage?: Pick<Storage, "getItem" | "setItem">;

  constructor(key = storageKey, storage = typeof window !== "undefined" ? window.localStorage : undefined) {
    this.key = key;
    this.storage = storage;
  }

  public load(): RecentAndFavoritesState {
    const raw = this.storage?.getItem(this.key);
    if (!raw) {
      return defaultState;
    }

    try {
      const parsed = JSON.parse(raw) as RecentAndFavoritesState;
      return toFrozenState({
        recents: Array.isArray(parsed.recents) ? parsed.recents : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      });
    } catch {
      return defaultState;
    }
  }

  public save(state: RecentAndFavoritesState): void {
    this.storage?.setItem(this.key, JSON.stringify(state));
  }
}

export class RecentAndFavoritesService {
  constructor(
    private readonly store: RecentAndFavoritesStore = new LocalStorageRecentAndFavoritesStore(),
    private readonly maxRecentItems = 20,
  ) {}

  public recordRecentAsset(input: { assetId: string; title: string; launchPath: string }): RecentAndFavoritesState {
    const next: RecentItem = Object.freeze({
      id: `${RecentItemTypes.asset}:${input.assetId}`,
      type: RecentItemTypes.asset,
      title: input.title,
      subtitle: "Recently opened asset",
      launchPath: input.launchPath,
      recordedAtIso: new Date().toISOString(),
    });
    return this.writeRecents(next);
  }

  public recordRecentBuildFlow(input: { intent: BuildIntent; launchPath: string }): RecentAndFavoritesState {
    const next: RecentItem = Object.freeze({
      id: `${RecentItemTypes.buildFlow}:${input.intent}`,
      type: RecentItemTypes.buildFlow,
      title: this.toBuildFlowTitle(input.intent),
      subtitle: "Recently used build flow",
      launchPath: input.launchPath,
      recordedAtIso: new Date().toISOString(),
    });
    return this.writeRecents(next);
  }

  public recordRecentRunContext(input: { request: RunLaunchRequest; launchPath: string }): RecentAndFavoritesState {
    const label = input.request.runIntentLabel?.trim() || "Run and test";
    const next: RecentItem = Object.freeze({
      id: `${RecentItemTypes.runContext}:${input.request.contextKind ?? "general"}:${input.request.assetId ?? "none"}`,
      type: RecentItemTypes.runContext,
      title: label,
      subtitle: "Recently used run context",
      launchPath: input.launchPath,
      recordedAtIso: new Date().toISOString(),
    });
    return this.writeRecents(next);
  }

  public listState(): RecentAndFavoritesState {
    return this.store.load();
  }

  public listRecents(limit = 6): ReadonlyArray<RecentItem> {
    return this.store.load().recents.slice(0, Math.max(0, limit));
  }

  public listFavorites(): ReadonlyArray<FavoriteItem> {
    return this.store.load().favorites;
  }

  public isFavorite(itemId: string): boolean {
    return this.store.load().favorites.some((entry) => entry.itemId === itemId);
  }

  public toggleFavorite(request: FavoriteToggleRequest): RecentAndFavoritesState {
    const state = this.store.load();
    const existing = state.favorites.find((entry) => entry.itemId === request.itemId);
    const favorites = existing
      ? state.favorites.filter((entry) => entry.itemId !== request.itemId)
      : [
          Object.freeze({
            id: `favorite:${request.itemId}`,
            itemId: request.itemId,
            title: request.title,
            launchPath: request.launchPath,
            createdAtIso: new Date().toISOString(),
          }),
          ...state.favorites,
        ];

    const next = toFrozenState({ recents: state.recents, favorites: Object.freeze(favorites.slice(0, this.maxRecentItems)) });
    this.store.save(next);
    return next;
  }

  public resolveReopenAction(item: Pick<RecentItem | FavoriteItem, "launchPath">): string {
    return item.launchPath;
  }

  private writeRecents(nextItem: RecentItem): RecentAndFavoritesState {
    const state = this.store.load();
    const next = toFrozenState({
      recents: upsertRecent(state.recents, nextItem, this.maxRecentItems),
      favorites: state.favorites,
    });
    this.store.save(next);
    return next;
  }

  private toBuildFlowTitle(intent: BuildIntent): string {
    switch (intent) {
      case "automate-task":
        return "Automate a task";
      case "create-assistant":
        return "Create an AI assistant";
      case "train-model":
        return "Train a model";
      case "work-with-data":
        return "Work with data";
      case "start-from-scratch":
        return "Start from scratch";
      default:
        return "Continue build flow";
    }
  }
}
