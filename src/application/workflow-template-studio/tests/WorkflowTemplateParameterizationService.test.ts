import { describe, expect, it } from "bun:test";
import { createWorkflowTemplateParameterDefinition } from "../../../domain/workflow-template-studio/WorkflowTemplateCompositionDomain";
import { applyWorkflowTemplateParameterDefaults } from "../WorkflowTemplateParameterizationService";

describe("WorkflowTemplateParameterizationService", () => {
  it("applies defaults, merges overrides, and validates", () => {
    const definitions = [
      createWorkflowTemplateParameterDefinition({ parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: 20, validation: { min: 1 } }),
      createWorkflowTemplateParameterDefinition({ parameterId: "seed", name: "Seed", type: "number", required: false }),
    ];

    const applied = applyWorkflowTemplateParameterDefaults({
      definitions,
      overrides: { steps: 30 },
    });

    expect(applied.values.steps).toBe(30);
    expect(() => applyWorkflowTemplateParameterDefaults({ definitions, overrides: { steps: "bad" } })).toThrow("Invalid workflow template parameters");
  });

  it("fails for missing required values when no default exists", () => {
    const definitions = [
      createWorkflowTemplateParameterDefinition({ parameterId: "prompt", name: "Prompt", type: "string", required: true }),
    ];

    expect(() => applyWorkflowTemplateParameterDefaults({ definitions })).toThrow("Invalid workflow template parameters");
  });

  it("enforces cross-parameter dependency rules", () => {
    const definitions = [
      createWorkflowTemplateParameterDefinition({
        parameterId: "mode",
        name: "Mode",
        type: "enum",
        required: true,
        defaultValue: "advanced",
        validation: { enumValues: ["basic", "advanced"] },
        dependencyRules: [{ kind: "requires-when-equals", parameterId: "advancedPrompt", equals: "advanced" }],
      }),
      createWorkflowTemplateParameterDefinition({ parameterId: "advancedPrompt", name: "Advanced Prompt", type: "string", required: false }),
    ];

    expect(() => applyWorkflowTemplateParameterDefaults({ definitions })).toThrow("required when 'mode' equals");

    const applied = applyWorkflowTemplateParameterDefaults({ definitions, overrides: { advancedPrompt: "high detail" } });
    expect(applied.values.advancedPrompt).toBe("high detail");
  });
});
