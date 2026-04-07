import { AssetSelectorSessionStore } from "@application/studio-entry/AssetSelectorSessionStore";

const selectorSessionStore = new AssetSelectorSessionStore();

export function getAssetSelectorSessionStore(): AssetSelectorSessionStore {
  return selectorSessionStore;
}

