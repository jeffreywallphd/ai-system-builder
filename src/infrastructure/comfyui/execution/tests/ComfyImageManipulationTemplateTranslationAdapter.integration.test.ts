import { describe, expect, it } from "bun:test";
import {
  ImageManipulationTranslationContractsSchemaVersion,
  ImageManipulationTranslationStatuses,
  type ImageManipulationTranslationRequest,
} from "@application/image-workflows/ports";
import {
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialImageWorkflowTemplateDefinition,
} from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";
import { ComfyImageManipulationTemplateTranslationAdapter } from "../mappers/ComfyImageManipulationTemplateTranslationAdapter";

function buildRequestFromTemplate(template: InitialImageWorkflowTemplateDefinition): ImageManipulationTranslationRequest {
  const parameterValues = template.configuration.defaults.parameterValues;

  return {
    contractVersion: ImageManipulationTranslationContractsSchemaVersion,
    translationRequestId: `translation:${template.templateFamilyId}`,
    runId: `run:${template.templateFamilyId}`,
    workspaceId: "workspace:integration",
    requestedAt: "2026-04-08T20:00:00.000Z",
    authoritative: {
      workflow: {
        workflowId: template.templateFamilyId,
        workflowLineageId: template.templateFamilyId.replace(/:v\d+$/i, ""),
        workflowVersionTag: "1.0.0",
        workflowRevision: 1,
        operationKind: template.operationKind,
        backendTranslation: {
          translatorId: template.translation.adapterFamily,
          contractVersion: "1.0.0",
          templateId: template.templateFamilyId,
          templateVersion: "v1",
          inputBindings: template.translation.inputMappings.map((entry) => Object.freeze({
            inputId: entry.inputId,
            backendField: entry.translationKey,
          })),
          parameterBindings: template.translation.parameterMappings.map((entry) => Object.freeze({
            parameterId: entry.parameterId,
            backendField: entry.translationKey,
          })),
          outputBindings: template.translation.outputMappings.map((entry) => Object.freeze({
            outputId: entry.outputId,
            backendField: entry.translationKey,
          })),
        },
      },
      system: {
        systemId: `system:${template.templateFamilyId}`,
        workflowBinding: {
          workflowId: template.templateFamilyId,
          workflowLineageId: template.templateFamilyId.replace(/:v\d+$/i, ""),
          workflowVersionTag: "1.0.0",
          workflowRevision: 1,
          requiredInputIds: template.minimumRequirements.inputSlots.filter((entry) => entry.required).map((entry) => entry.inputId),
          requiredParameterIds: template.minimumRequirements.parameterSpecifications
            .filter((entry) => entry.required)
            .map((entry) => entry.parameterId),
          requiredOutputIds: template.minimumRequirements.outputExpectations
            .filter((entry) => entry.required)
            .map((entry) => entry.outputId),
        },
        parameterBaseline: {
          values: parameterValues,
          profileReferences: [],
        },
      },
    },
    templateResolution: {
      translatorId: template.translation.adapterFamily,
      contractVersion: "1.0.0",
      templateId: template.templateFamilyId,
      templateVersion: "v1",
      adapterFamily: template.translation.adapterFamily,
      operationTypeKey: template.translation.operationTypeKey,
    },
    slotBindings: template.translation.inputMappings.map((entry, index) => Object.freeze({
      bindingId: `slot-${index + 1}`,
      inputId: entry.inputId,
      backendField: entry.translationKey,
      sourceKind: "input-asset",
      logicalReference: `asset://input/${entry.inputId}`,
      required: entry.required,
    })),
    parameterMappings: template.translation.parameterMappings.map((entry) => Object.freeze({
      parameterId: entry.parameterId,
      backendField: entry.translationKey,
      value: parameterValues[entry.parameterId],
      source: "system-baseline",
    })),
    outputExpectations: template.translation.outputMappings.map((entry) => Object.freeze({
      outputId: entry.outputId,
      backendField: entry.translationKey,
      required: entry.required,
      allowsMultiple: false,
      logicalTargetReference: `dataset-instance://output/${entry.outputId}`,
    })),
    capabilityRequirements: {
      requiredCapabilities: [template.compatibility.requiredOperationCapability],
      preferredBackendFamily: template.compatibility.translationBackendFamilies[0],
    },
  };
}

describe("ComfyImageManipulationTemplateTranslationAdapter integration", () => {
  it("translates each supported initial template family from authoritative workflow/system inputs", async () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();

    for (const template of registry.list()) {
      const request = buildRequestFromTemplate(template);
      const result = await adapter.translateToBackendPayload(request);

      expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
      if (result.status === ImageManipulationTranslationStatuses.succeeded) {
        expect(result.executionPayload.template.templateId).toBe(template.templateFamilyId);
        expect(result.executionPayload.requestContext.workflowId).toBe(template.templateFamilyId);
        expect(result.executionPayload.inputs["comfy.request"]).toBeDefined();
      }
    }
  });
});
