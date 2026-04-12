import { describe, expect, it } from "bun:test";
import { ImageWorkflowParameterSensitivityLevels } from "@domain/image-workflows/ImageWorkflowParameterSpecification";
import { resolveStudioTemplateWorkflowDefinitionById } from "../StudioImageSystemDefinitionSupport";

describe("StudioImageSystemDefinitionSupport", () => {
  it("hydrates template workflow parameters with explicit sensitivity", () => {
    const workflow = resolveStudioTemplateWorkflowDefinitionById("image-template:enhance-upscale:v1");
    expect(workflow).toBeDefined();
    expect(workflow?.parameterSpecifications.length).toBeGreaterThan(0);
    for (const parameter of workflow?.parameterSpecifications ?? []) {
      expect(parameter.sensitivity).toBe(ImageWorkflowParameterSensitivityLevels.normal);
    }
  });
});
