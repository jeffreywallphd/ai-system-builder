import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "@domain/system-studio/SystemContextContract";
import { createWorkflowInputBindingDescriptor, WorkflowInputBindingSourceKinds } from "@domain/workflow-studio/WorkflowInputBindingDomain";
import { SystemContextValidationService } from "../SystemContextValidationService";

describe("SystemContextValidationService", () => {
  it("validates required context values, dataset schema contracts, media expectations, and workflow input contracts", () => {
    const service = new SystemContextValidationService();
    const context = createSystemContextContract({
      selectedImages: [{
        selectionId: "image-1",
        imageId: "image-1",
        assetRef: { assetId: "asset:image-1", recordId: "record:image-1" },
        metadata: { width: 1024, height: 1024, format: "png" },
      }],
      parameters: {
        prompt: "  watercolor style  ",
      },
      datasets: [{
        referenceId: "active-input",
        instanceId: "instance:input",
        datasetAssetId: "dataset:images",
        role: "active-input",
        metadata: {
          schemaIntentId: "media-input",
          sampleRecordValue: { assetRef: { assetId: "asset:image-1" } },
          sampleRecords: [{ recordId: "record-1", value: { assetRef: { assetId: "asset:image-1" } } }],
        },
      }],
    });

    const result = service.validate({
      context,
      requiredParameterKeys: ["prompt"],
      mediaSchema: {
        required: true,
        requireAssetReference: true,
        requiredMetadataFields: ["width", "height", "format"],
      },
      datasetSchemaContracts: [{
        datasetAssetId: "dataset:images",
        schemaIntentId: "media-input",
        expectedRecordValueType: "object",
        required: true,
      }],
      workflowInputBindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.prompt",
          inputId: "prompt",
          required: true,
          valueType: "string",
          sources: [{ sourceId: "form", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "prompt", priority: 1 }],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.source-image",
          inputId: "sourceImage",
          required: true,
          valueType: "object",
          sources: [{ sourceId: "selected", kind: WorkflowInputBindingSourceKinds.selectedImage, path: "assetRef", priority: 1 }],
        }),
      ],
    });

    expect(result.valid).toBeTrue();
    expect(result.normalizedContext.parameters.prompt).toBe("watercolor style");
    expect(result.issues).toHaveLength(0);
    expect(result.bindingPreview?.unresolvedItems).toEqual([]);
  });

  it("returns inspectable blocking issues for required parameter, dataset contract, and unresolved workflow input failures", () => {
    const service = new SystemContextValidationService();
    const context = createSystemContextContract({
      selectedImages: [{ selectionId: "image-1" }],
      parameters: {
        prompt: "   ",
      },
      datasets: [{
        referenceId: "active-input",
        datasetAssetId: "dataset:images",
        metadata: { schemaIntentId: "tabular" },
      }],
    });

    const result = service.validate({
      context,
      requiredParameterKeys: ["prompt"],
      mediaSchema: {
        required: true,
        requireAssetReference: true,
      },
      datasetSchemaContracts: [{
        datasetAssetId: "dataset:images",
        schemaIntentId: "media",
        required: true,
      }],
      workflowInputBindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.source-image",
          inputId: "sourceImage",
          required: true,
          valueType: "object",
          sources: [{ sourceId: "selected", kind: WorkflowInputBindingSourceKinds.selectedImage, path: "assetRef", priority: 1 }],
        }),
      ],
    });

    expect(result.valid).toBeFalse();
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("required-parameter-missing");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("selected-image-invalid");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("dataset-schema-intent-mismatch");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("dataset-reference-unresolved");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("workflow-input-unresolved");
  });
});

