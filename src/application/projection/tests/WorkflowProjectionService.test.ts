import { describe, expect, it } from "bun:test";
import { WorkflowProjectionService } from "../WorkflowProjectionService";
import { WorkflowToolProjectionService } from "../WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "@domain/services/tests/testUtils";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";

function makeProjectedWorkflow() {
  const node = makeNode({
    id: "n1",
    properties: [
      new NodeProperty({
        id: "prompt",
        name: "Prompt",
        description: "Internal prompt field",
        type: "text",
        value: "hello",
        defaultValue: "draft",
        order: 7,
        isEditable: true,
        constraints: {
          required: true,
          range: {
            min: 1,
            max: 10,
            step: 1,
            defaultValue: 4,
          },
        },
        projection: {
          label: "Ask",
          description: "What should this tool help with?",
          group: "Inputs",
          order: 2,
          fieldTypeHint: "multiline-text",
          authorVisibility: "basic",
          toolVisibility: "basic",
        },
      }),
    ],
  }).withNotes("Collect the core request.");

  return makeWorkflow({ id: "wf1", nodes: [node] });
}

describe("WorkflowProjectionService", () => {
  it("projects workflow to author form", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "hello" })] });
    const schema = new WorkflowProjectionService().projectToForm(makeWorkflow({ id: "wf1", nodes: [node] }));
    expect(schema.sections.length).toBeGreaterThan(0);
    expect(schema.sections[0]?.fields[0]?.id).toBe("n1.p1");
  });

  it("reuses projection metadata that is compatible with the tool surface", () => {
    const workflow = makeProjectedWorkflow();
    const form = new WorkflowProjectionService().projectToForm(workflow);
    const tool = new WorkflowToolProjectionService().projectToTool(workflow);
    const formSection = form.sections[0];
    const toolSection = tool.sections[0];
    const formField = formSection?.fields[0];
    const toolField = toolSection?.fields[0];

    expect(formSection).toEqual(toolSection);
    expect(formField).toEqual(toolField);
    expect(formField).toMatchObject({
      label: "Ask",
      description: "What should this tool help with?",
      type: "multiline-text",
      order: 2,
      sectionId: "Inputs",
      required: true,
      min: 1,
      max: 10,
      step: 1,
      shouldClampToRange: true,
    });
  });

  it("projects richer author-facing workflow context controls including recipes", () => {
    const workflow = makeWorkflow({ id: "wf-context" }).withMetadata(
      new WorkflowMetadata({
        name: "WF",
        contextConfiguration: {
          recipeSelections: [{ recipeId: "company-default", alias: "Company default", surfaceInTool: true }],
          selectedRecipeIds: ["company-default"],
          packageReferences: [{ packageId: "pkg-style", alias: "Style guide" }],
          selectedPackageIds: ["pkg-style"],
          visibilityMode: "advanced",
          maxCharacters: 800,
        },
      })
    );

    const schema = new WorkflowProjectionService().projectToForm(workflow);
    const contextSection = schema.sections.find((section) => section.id === "workflow-context");

    expect(contextSection?.fields.map((field) => field.label)).toEqual([
      "Context recipes",
      "Default recipe selection",
      "Context packages",
      "Default package selection",
      "Visible context detail",
      "Character budget",
      "Token budget",
      "Allow partial fragment trim",
    ]);
  });

  it("keeps context recipe and package ordering deterministic for author forms and default selection", () => {
    const workflow = makeWorkflow({ id: "wf-context" }).withMetadata(
      new WorkflowMetadata({
        name: "WF",
        contextConfiguration: {
          recipeSelections: [
            { recipeId: "recipe-zeta", alias: "Zeta" },
            { recipeId: "recipe-alpha", alias: "Alpha", isEnabled: false },
            { recipeId: "recipe-beta", alias: "Beta", surfaceInTool: false },
          ],
          selectedRecipeIds: ["recipe-beta", "recipe-alpha", "recipe-zeta"],
          packageReferences: [
            { packageId: "pkg-zeta", alias: "Zeta" },
            { packageId: "pkg-alpha", alias: "Alpha", isEnabled: false },
            { packageId: "pkg-beta", alias: "Beta" },
          ],
          selectedPackageIds: ["pkg-beta", "pkg-alpha", "pkg-zeta"],
          visibilityMode: "advanced",
        },
      })
    );

    const schema = new WorkflowProjectionService().projectToForm(workflow);
    const contextSection = schema.sections.find((section) => section.id === "workflow-context");
    const recipeField = contextSection?.fields.find((field) => field.id === "workflow.context.recipeSelections");
    const recipeSelectionField = contextSection?.fields.find((field) => field.id === "workflow.context.selectedRecipeIds");
    const selectionField = contextSection?.fields.find((field) => field.id === "workflow.context.selectedPackageIds");

    expect((recipeField?.value as Array<{ recipeId: string }>).map((selection) => selection.recipeId)).toEqual([
      "recipe-zeta",
      "recipe-alpha",
      "recipe-beta",
    ]);
    expect(recipeSelectionField?.value).toEqual(["recipe-zeta", "recipe-beta"]);
    expect(selectionField?.options).toEqual([
      { label: "Zeta", value: "pkg-zeta" },
      { label: "Beta", value: "pkg-beta" },
    ]);
    expect(selectionField?.value).toEqual(["pkg-zeta", "pkg-beta"]);
  });
});

