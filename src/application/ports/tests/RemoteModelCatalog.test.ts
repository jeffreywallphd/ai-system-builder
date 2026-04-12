import { describe, expect, it } from "bun:test";
import {
  RemoteModelCatalog,
  RemoteModelCatalogItem,
  RemoteModelCatalogSearchResult,
} from "../RemoteModelCatalog";
import type { IRemoteModelCatalog } from "../interfaces/IRemoteModelCatalog";
import { makeModel } from "./testUtils";

describe("RemoteModelCatalog", () => {
  const modelA = makeModel({ id: "m-a", name: "Anime XL" });
  const modelB = makeModel({
    id: "m-b",
    name: "Chat LLM",
    kind: "llm",
    architectureFamily: "llama",
    compatibility: { ...makeModel().compatibility, supportedTasks: ["chat"], supportedRuntimes: ["vllm"], inputModalities: ["text"], outputModalities: ["text"] } as any,
    tags: ["chat"],
    isRunnable: false,
  });

  it("validates item and result wrappers", () => {
    const item = new RemoteModelCatalogItem({ model: modelA, provider: "hf", remoteId: " repo/a ", requiresAuth: true });
    const result = new RemoteModelCatalogSearchResult({ items: [item], nextCursor: " c1 " });

    expect(item.remoteId).toBe("repo/a");
    expect(result.nextCursor).toBe("c1");
    expect(() => new RemoteModelCatalogItem({ model: modelA, provider: " " })).toThrow();
  });

  it("searches across providers, filters and ranks results", async () => {
    const p1: IRemoteModelCatalog = {
      search: async () => ({ items: [new RemoteModelCatalogItem({ model: modelA, provider: "hf", isInstallable: true })] }),
      getById: async () => undefined,
      supportsProvider: (p) => p.toLowerCase() === "hf",
    };
    const p2: IRemoteModelCatalog = {
      search: async () => ({ items: [new RemoteModelCatalogItem({ model: modelB, provider: "civitai", isInstallable: false })] }),
      getById: async () => undefined,
      supportsProvider: (p) => p.toLowerCase() === "civitai",
    };

    const catalog = new RemoteModelCatalog([p1, p2]);
    const byKind = await catalog.search({ kinds: ["llm"] as any });
    expect(byKind.items.map((i) => i.model.id)).toEqual(["m-b"]);

    const byProvider = await catalog.search({ providers: ["hf"], limit: 1 });
    expect(byProvider.items).toHaveLength(1);
    expect(byProvider.items[0]?.provider).toBe("hf");

    const runnable = await catalog.search({ runnableOnly: true });
    expect(runnable.items.map((i) => i.model.id)).toEqual(["m-a"]);
  });

  it("gets by id through direct provider lookup and fallback search", async () => {
    const directItem = new RemoteModelCatalogItem({ model: modelA, provider: "hf", remoteId: "org/anime" });
    const p: IRemoteModelCatalog = {
      search: async () => ({ items: [directItem] }),
      getById: async (id) => (id === "org/anime" ? directItem : undefined),
      supportsProvider: () => true,
    };
    const catalog = new RemoteModelCatalog([p]);

    expect((await catalog.getById("org/anime"))?.model.id).toBe("m-a");
    expect((await catalog.getById("m-a"))?.model.id).toBe("m-a");
    expect(catalog.supportsProvider("HF")).toBeTrue();
  });
});
