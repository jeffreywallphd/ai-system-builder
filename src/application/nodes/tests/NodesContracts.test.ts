import { describe, expect, it } from "bun:test";
import type { INodeCatalogProvider } from "../../ports/interfaces/INodeCatalogProvider";
import type { INodeCompatibilityService } from "@domain/services/interfaces/INodeCompatibilityService";
import { makeNodeCatalogProvider, makeNodeCompatibilityService } from "./testUtils";

describe("application/nodes contracts", () => {
  it("test adapters satisfy node contracts", async () => {
    const catalog: INodeCatalogProvider = makeNodeCatalogProvider();
    const compat: INodeCompatibilityService = makeNodeCompatibilityService();

    expect(await catalog.listDefinitions()).toEqual([]);
    expect(compat.evaluatePortCompatibility({} as any, {} as any).isCompatible).toBeTrue();
  });
});

