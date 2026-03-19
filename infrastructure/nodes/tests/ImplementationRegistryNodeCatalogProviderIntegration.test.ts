import { describe, expect, it } from "bun:test";
import { createCompositeNodeImplementationRegistry } from "../NodeProviderRegistryIndex";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";

describe("ImplementationRegistryNodeCatalogProvider integration", () => {
  it("surfaces palette-ready definitions from the composite provider registry", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      createCompositeNodeImplementationRegistry()
    );

    const definitions = await provider.getAllDefinitions();
    const categories = await provider.getCategories();

    expect(definitions.find((definition) => definition.type === "langchain.simple_agent")?.category).toBe(
      "LangChain / Assistants"
    );
    expect(
      definitions.find((definition) => definition.type === "shared.document-uploader")?.description
    ).toContain("Uploads a local document");
    expect(definitions.find((definition) => definition.type === "PromptText")?.category).toBe(
      "text/input"
    );
    expect(definitions.find((definition) => definition.type === "langchain.vector_store_upsert")?.properties.map((property) => property.id)).toEqual([
      "storeType",
      "collectionName",
    ]);
    expect(categories).toContain("LangChain / Knowledge");
    expect(categories).toContain("input");
    expect(categories).toContain("text/input");
  });

  it("prefers registry-backed descriptions over fallback placeholders when metadata exists", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      createCompositeNodeImplementationRegistry()
    );

    const llmChat = await provider.getDefinitionByType("langchain.llm_chat");
    const documentUploader = await provider.getDefinitionByType("shared.document-uploader");

    expect(llmChat?.description).toContain("Ask the AI");
    expect(llmChat?.description).not.toContain("Registered runtime node");
    expect(documentUploader?.description).toContain("Uploads a local document");
    expect(documentUploader?.description).not.toContain("Registered runtime node");
  });
});
