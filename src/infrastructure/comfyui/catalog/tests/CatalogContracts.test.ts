import { describe, expect, it } from "bun:test";
import type { INodeCatalogProvider } from "@application/ports/interfaces/INodeCatalogProvider";
import { ComfyNodeCatalogProvider } from "../ComfyNodeCatalogProvider";

describe("catalog contracts", () => {
  it("implements node catalog provider contract", async () => {
    const provider: INodeCatalogProvider = new ComfyNodeCatalogProvider({});
    expect(await provider.getAllDefinitions()).toEqual([]);
  });
});

