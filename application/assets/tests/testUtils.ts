import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";

export function makeAsset(id = "asset-1") {
  return new Asset({
    id,
    name: id,
    kind: "input",
    status: "available",
    source: new AssetSourceInfo({ type: "workflow-input", workflowId: "wf" }),
    location: new AssetLocation({ accessMethod: "local-file", location: `/tmp/${id}.bin` }),
  });
}

export function makeAssetCatalog(overrides: Partial<IAssetCatalog> = {}): IAssetCatalog {
  return {
    list: async () => [],
    getById: async () => undefined,
    save: async (asset) => asset,
    remove: async () => false,
    ...overrides,
  };
}

export function makeFileStorage(overrides: Partial<IFileStorage> = {}): IFileStorage {
  return {
    read: async (path) => ({ path, content: new Uint8Array() }),
    readText: async () => "",
    write: async () => undefined,
    delete: async () => undefined,
    exists: async () => false,
    stat: async (path) => ({ path, kind: "file", sizeBytes: 10 }),
    list: async () => [],
    mkdir: async () => undefined,
    copy: async () => undefined,
    move: async () => undefined,
    ...overrides,
  };
}
