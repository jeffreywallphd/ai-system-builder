import { describe, expect, it } from "bun:test";
import { ListAvailableNodesUseCase } from "../ListAvailableNodesUseCase";
import { NodeDefinition } from "../../../domain/nodes/NodeDefinition";
import { makeNodeCatalogProvider } from "./testUtils";

describe("ListAvailableNodesUseCase", () => {
  it("lists definitions by criteria", async () => {
    const def = new NodeDefinition({ id: "d1", type: "t1", title: "T1", category: "utility" });
    const useCase = new ListAvailableNodesUseCase(
      makeNodeCatalogProvider({ searchDefinitions: async () => [def] })
    );

    const result = await useCase.execute({ criteria: { query: "t" } });
    expect(result.definitions.map((d) => d.id)).toEqual(["d1"]);
  });
});
