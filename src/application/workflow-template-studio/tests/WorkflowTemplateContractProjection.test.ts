import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../ImageManipulationWorkflowTemplate";
import { createWorkflowTemplateContractProjection } from "../WorkflowTemplateContractProjection";

describe("createWorkflowTemplateContractProjection", () => {
  it("projects workflow-template interfaces into a concrete asset contract", () => {
    const contract = createWorkflowTemplateContractProjection(ImageManipulationWorkflowTemplate);
    const inputSchema = contract.input?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;
    const outputSchema = contract.output?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;

    expect(inputSchema?.properties?.sourceImage?.type).toBe("image-reference");
    expect(inputSchema?.properties?.instruction?.type).toBe("string");
    expect(outputSchema?.properties?.images?.type).toBe("image-metadata-records");
    expect(contract.parameters.some((parameter) => parameter.id === "resultCount")).toBeTrue();
  });
});
