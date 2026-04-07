import { describe, expect, it } from "bun:test";
import { CreateNodeUseCase } from "../CreateNodeUseCase";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodePort } from "../../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { makeNodeCatalogProvider } from "./testUtils";

const definition = new NodeDefinition({
  id: "def-1",
  type: "prompt",
  title: "Prompt",
  category: "input",
  inputPorts: [new NodePort({ id: "in", name: "in", direction: "input" })],
  outputPorts: [new NodePort({ id: "out", name: "out", direction: "output" })],
  properties: [new NodeProperty({ id: "text", name: "Text", type: "text", value: "" })],
});

describe("CreateNodeUseCase", () => {
  it("creates node by definition type with property overrides", async () => {
    const useCase = new CreateNodeUseCase(
      makeNodeCatalogProvider({ getDefinitionByType: async () => definition }),
      () => "generated"
    );

    const result = await useCase.execute({
      workflow: makeWorkflow({ id: "wf" }),
      definitionType: "prompt",
      propertyValues: { text: "hello" },
      title: " Title ",
    });

    expect(result.node.id).toBe("generated");
    expect(result.node.title).toBe("Title");
    expect(result.workflow.hasNode("generated")).toBeTrue();
  });

  it("throws when definition is missing", async () => {
    const useCase = new CreateNodeUseCase(makeNodeCatalogProvider());
    await expect(useCase.execute({ workflow: makeWorkflow({}), definitionId: "missing" })).rejects.toThrow("not found");
  });

  it("allows adding a node with required properties when create-time validation is disabled", async () => {
    const requiredDefinition = new NodeDefinition({
      id: "def-required",
      type: "shared.document-uploader",
      title: "Document uploader",
      category: "input",
      inputPorts: [],
      outputPorts: [new NodePort({ id: "document", name: "Document", direction: "output" })],
      properties: [
        new NodeProperty({
          id: "document",
          name: "Document",
          type: "file",
          value: null,
          constraints: { required: true },
        }),
      ],
    });

    const useCase = new CreateNodeUseCase(
      makeNodeCatalogProvider({ getDefinitionByType: async () => requiredDefinition }),
      () => "generated-required"
    );

    const result = await useCase.execute({
      workflow: makeWorkflow({ id: "wf" }),
      definitionType: "shared.document-uploader",
    });

    expect(result.workflow.hasNode("generated-required")).toBeTrue();
  });

  it("rejects invalid nodes when create-time validation is explicitly enabled", async () => {
    const requiredDefinition = new NodeDefinition({
      id: "def-required",
      type: "shared.document-uploader",
      title: "Document uploader",
      category: "input",
      inputPorts: [],
      outputPorts: [new NodePort({ id: "document", name: "Document", direction: "output" })],
      properties: [
        new NodeProperty({
          id: "document",
          name: "Document",
          type: "file",
          value: null,
          constraints: { required: true },
        }),
      ],
    });

    const useCase = new CreateNodeUseCase(
      makeNodeCatalogProvider({ getDefinitionByType: async () => requiredDefinition }),
      () => "generated-required"
    );

    await expect(
      useCase.execute({
        workflow: makeWorkflow({ id: "wf" }),
        definitionType: "shared.document-uploader",
        validateNode: true,
      })
    ).rejects.toThrow("Created node 'generated-required' is invalid: Document is required.");
  });
});
