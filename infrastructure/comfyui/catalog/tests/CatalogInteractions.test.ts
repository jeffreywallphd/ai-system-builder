import { describe, expect, it } from "bun:test";
import { ComfyNodeCatalogProvider } from "../ComfyNodeCatalogProvider";

describe("catalog interactions", () => {
  it("mapped definitions are reusable by id and type", async () => {
    const provider = new ComfyNodeCatalogProvider({ SaveImage: { output_node: true } });
    const byId = await provider.getDefinitionById("saveimage");
    const byType = await provider.getDefinitionByType("SaveImage");
    expect(byId?.id).toBe(byType?.id);
  });
});
