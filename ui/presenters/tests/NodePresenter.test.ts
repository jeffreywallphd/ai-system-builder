import { describe, expect, it } from "bun:test";
import { NodeDefinition } from "../../../domain/nodes/NodeDefinition";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import { NodePresenter } from "../NodePresenter";

describe("NodePresenter", () => {
  it("includes property summary metadata for palette items", () => {
    const presenter = new NodePresenter();
    const definition = new NodeDefinition({
      id: "langchain.prompt-template",
      type: "langchain.prompt-template",
      title: "Prompt Template",
      category: "LangChain",
      properties: [
        new NodeProperty({
          id: "template",
          name: "Template",
          type: "multiline-text",
          value: "",
          constraints: { required: true },
        }),
      ],
    });

    const item = presenter.presentPaletteItem(definition);

    expect(item.properties.length).toBe(1);
    expect(item.properties[0]?.name).toBe("Template");
    expect(item.properties[0]?.isRequired).toBeTrue();
    expect(item.inputPorts.length).toBeGreaterThanOrEqual(0);
    expect(item.outputPorts.length).toBeGreaterThanOrEqual(0);
  });
});
