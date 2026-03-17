import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { LocalNodeImplementationRegistry } from "../local/LocalNodeImplementationRegistry";

describe("Shared node catalog definitions", () => {
  it("registers document uploader and chunk displayer with compatible ports", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new LocalNodeImplementationRegistry()
    );

    const definitions = await provider.getAllDefinitions();
    const uploader = definitions.find((definition) => definition.type === "shared.document-uploader");
    const displayer = definitions.find((definition) => definition.type === "shared.chunk-displayer");

    expect(uploader).toBeDefined();
    expect(displayer).toBeDefined();
    expect(uploader?.outputPorts.find((port) => port.id === "document")?.compatibility.valueTypes).toContain("document");
    expect(displayer?.inputPorts.find((port) => port.id === "chunks")?.compatibility.valueTypes).toContain("chunks");
  });

  it("keeps the uploader document property marked as required", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new LocalNodeImplementationRegistry()
    );

    const uploader = await provider.getDefinitionByType("shared.document-uploader");
    const documentProperty = uploader?.getProperty("document");

    expect(documentProperty?.constraints?.required).toBeTrue();
  });

});
