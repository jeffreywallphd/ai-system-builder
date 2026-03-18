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

  it("surfaces range metadata for property editors", () => {
    const presenter = new NodePresenter();
    const field = presenter.presentProperty(
      new NodeProperty({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.7,
        defaultValue: 0.7,
        constraints: {
          range: {
            min: 0,
            max: 2,
            step: 0.1,
            defaultValue: 0.7,
          },
        },
      })
    );

    expect(field.defaultValue).toBe(0.7);
    expect(field.min).toBe(0);
    expect(field.max).toBe(2);
    expect(field.step).toBe(0.1);
    expect(field.shouldClampToRange).toBeTrue();
  });
});
