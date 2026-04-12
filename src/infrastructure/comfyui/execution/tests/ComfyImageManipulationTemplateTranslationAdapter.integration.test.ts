import { describe, expect, it } from "bun:test";
import {
  ImageManipulationTranslationContractsSchemaVersion,
  ImageManipulationTranslationStatuses,
  type ImageManipulationTranslationRequest,
} from "@application/image-workflows/ports";
import {
  InitialImageWorkflowTemplateFamilyIds,
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialImageWorkflowTemplateDefinition,
} from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";
import { ComfyImageManipulationTemplateTranslationAdapter } from "../mappers/ComfyImageManipulationTemplateTranslationAdapter";

interface SupportedTemplateTranslationReadinessCase {
  readonly templateId: string;
  readonly operationKind: string;
  readonly requiredInputFields: ReadonlyArray<string>;
  readonly requiredParameterFields: ReadonlyArray<string>;
  readonly requiredOutputFields: ReadonlyArray<string>;
  readonly expectedPromptNodeTypes: ReadonlyArray<string>;
}

const supportedTemplateTranslationReadinessMatrix: ReadonlyArray<SupportedTemplateTranslationReadinessCase> = Object.freeze([
  Object.freeze({
    templateId: InitialImageWorkflowTemplateFamilyIds.imageToImageRestyle,
    operationKind: "image-to-image",
    requiredInputFields: Object.freeze(["inputs.source-image"]),
    requiredParameterFields: Object.freeze(["parameters.prompt", "parameters.variation-strength"]),
    requiredOutputFields: Object.freeze(["outputs.generated-image"]),
    expectedPromptNodeTypes: Object.freeze([
      "LoadImage",
      "CheckpointLoaderSimple",
      "CLIPTextEncode",
      "VAEEncode",
      "KSampler",
      "VAEDecode",
      "SaveImage",
    ]),
  }),
  Object.freeze({
    templateId: InitialImageWorkflowTemplateFamilyIds.enhanceUpscale,
    operationKind: "enhance-upscale",
    requiredInputFields: Object.freeze(["inputs.source-image"]),
    requiredParameterFields: Object.freeze(["parameters.scale-factor"]),
    requiredOutputFields: Object.freeze(["outputs.enhanced-image"]),
    expectedPromptNodeTypes: Object.freeze([
      "LoadImage",
      "ImageScaleBy",
      "SaveImage",
    ]),
  }),
  Object.freeze({
    templateId: InitialImageWorkflowTemplateFamilyIds.maskGuidedEdit,
    operationKind: "mask-guided-edit",
    requiredInputFields: Object.freeze(["inputs.source-image", "inputs.mask-image"]),
    requiredParameterFields: Object.freeze(["parameters.prompt"]),
    requiredOutputFields: Object.freeze(["outputs.edited-image"]),
    expectedPromptNodeTypes: Object.freeze([
      "LoadImage",
      "CheckpointLoaderSimple",
      "CLIPTextEncode",
      "VAEEncode",
      "SetLatentNoiseMask",
      "KSampler",
      "VAEDecode",
      "SaveImage",
    ]),
  }),
]);

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

function hasOwnRecordKey(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

describe("ComfyImageManipulationTemplateTranslationAdapter integration", () => {
  it("maintains an explicit translation-readiness matrix for every supported template family", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const supportedTemplateIds = registry.list().map((template) => template.templateFamilyId).sort();
    const coveredTemplateIds = supportedTemplateTranslationReadinessMatrix
      .map((entry) => entry.templateId)
      .sort();

    expect(coveredTemplateIds).toEqual(supportedTemplateIds);
  });

  it("verifies translation readiness for every supported template across compatibility, mappings, and expected outputs", async () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const templatesById = new Map(registry.list().map((template) => [template.templateFamilyId, template]));
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();

    for (const matrixEntry of supportedTemplateTranslationReadinessMatrix) {
      const template = templatesById.get(matrixEntry.templateId);
      expect(template).toBeDefined();
      if (!template) {
        continue;
      }

      const compatibility = registry.evaluateCompatibilityReadinessForOperationKind({
        operationKind: template.operationKind,
        availableOperationCapabilities: [template.compatibility.requiredOperationCapability],
        availableInputKinds: [...template.compatibility.requiredInputKinds],
        availableOutputKinds: [...template.compatibility.requiredOutputKinds],
        availableTranslationBackendFamilies: [...template.compatibility.translationBackendFamilies],
      });
      expect(compatibility.compatible).toBeTrue();
      expect(compatibility.issues).toHaveLength(0);

      const request = buildRequestFromTemplate(template);
      const result = await adapter.translateToBackendPayload(request);

      expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
      if (result.status === ImageManipulationTranslationStatuses.succeeded) {
        expect(result.executionPayload.template.templateId).toBe(matrixEntry.templateId);
        expect(result.executionPayload.operationKind).toBe(matrixEntry.operationKind);
        expect(result.executionPayload.backendFamily).toBe(template.compatibility.translationBackendFamilies[0]);
        expect(result.executionPayload.requestContext.workflowId).toBe(template.templateFamilyId);

        for (const requiredInputField of matrixEntry.requiredInputFields) {
          expect(hasOwnRecordKey(result.executionPayload.inputs, requiredInputField)).toBeTrue();
          expect(result.executionPayload.inputs[requiredInputField]).toBeDefined();
        }
        for (const requiredParameterField of matrixEntry.requiredParameterFields) {
          expect(hasOwnRecordKey(result.executionPayload.parameters, requiredParameterField)).toBeTrue();
          expect(result.executionPayload.parameters[requiredParameterField]).toBeDefined();
        }

        const requiredOutputBackendFields = result.executionPayload.outputs
          .filter((entry) => entry.required)
          .map((entry) => entry.backendField)
          .sort();
        expect(requiredOutputBackendFields).toEqual([...matrixEntry.requiredOutputFields].sort());

        const comfyRequest = result.executionPayload.inputs["comfy.request"] as {
          readonly prompt: Readonly<Record<string, { readonly class_type: string }>>;
        };
        expect(comfyRequest).toBeDefined();
        const translatedNodeTypes = new Set(Object.values(comfyRequest.prompt).map((entry) => entry.class_type));
        for (const expectedNodeType of matrixEntry.expectedPromptNodeTypes) {
          expect(translatedNodeTypes.has(expectedNodeType)).toBeTrue();
        }
      }
    }
  });

  it("fails loudly when required slot/parameter/output mappings are missing for supported templates", async () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();

    for (const template of registry.list()) {
      const requiredInputMapping = template.translation.inputMappings.find((entry) => entry.required);
      expect(requiredInputMapping).toBeDefined();
      if (requiredInputMapping) {
        const request = buildRequestFromTemplate(template);
        request.slotBindings = request.slotBindings.filter((entry) => entry.backendField !== requiredInputMapping.translationKey);
        const result = await adapter.translateToBackendPayload(request);

        expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
        if (result.status === ImageManipulationTranslationStatuses.failed) {
          expect(result.diagnostics.some((entry) => entry.code === "missing-required-slot-binding")).toBeTrue();
        }
      }

      const requiredParameterMapping = template.translation.parameterMappings.find((entry) => entry.required);
      expect(requiredParameterMapping).toBeDefined();
      if (requiredParameterMapping) {
        const request = buildRequestFromTemplate(template);
        request.parameterMappings = request.parameterMappings.filter(
          (entry) => entry.backendField !== requiredParameterMapping.translationKey,
        );
        const result = await adapter.translateToBackendPayload(request);

        expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
        if (result.status === ImageManipulationTranslationStatuses.failed) {
          expect(result.diagnostics.some((entry) => entry.code === "missing-required-parameter-mapping")).toBeTrue();
        }
      }

      const requiredOutputMapping = template.translation.outputMappings.find((entry) => entry.required);
      expect(requiredOutputMapping).toBeDefined();
      if (requiredOutputMapping) {
        const request = buildRequestFromTemplate(template);
        request.outputExpectations = request.outputExpectations.filter(
          (entry) => entry.backendField !== requiredOutputMapping.translationKey,
        );
        const result = await adapter.translateToBackendPayload(request);

        expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
        if (result.status === ImageManipulationTranslationStatuses.failed) {
          expect(result.diagnostics.some((entry) => entry.code === "missing-required-output-expectation")).toBeTrue();
        }
      }
    }
  });

  it("treats template/operation mismatches as explicit unsupported combinations", async () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();

    for (const template of registry.list()) {
      const unsupportedOperation = registry.list().find((entry) => entry.operationKind !== template.operationKind)?.operationKind;
      expect(unsupportedOperation).toBeDefined();
      if (!unsupportedOperation) {
        continue;
      }

      const request = buildRequestFromTemplate(template);
      request.authoritative.workflow = {
        ...request.authoritative.workflow,
        operationKind: unsupportedOperation,
      };
      request.templateResolution = {
        ...request.templateResolution,
        operationTypeKey: `operation.${unsupportedOperation}`,
      };

      const result = await adapter.translateToBackendPayload(request);
      expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
      if (result.status === ImageManipulationTranslationStatuses.failed) {
        expect(result.diagnostics.some((entry) => entry.code === "operation-template-mismatch")).toBeTrue();
      }
    }
  });
});
