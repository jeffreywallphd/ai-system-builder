import { describe, expect, it } from "bun:test";
import {
  ImageManipulationTranslationContractsSchemaVersion,
  ImageManipulationTranslationStatuses,
  type ImageManipulationTranslationRequest,
} from "@application/image-workflows/ports";
import { ComfyImageManipulationTemplateTranslationAdapter } from "../mappers/ComfyImageManipulationTemplateTranslationAdapter";

function createBaseRequest(input: {
  readonly templateId: string;
  readonly operationKind: string;
  readonly slotBindings: ReadonlyArray<{ readonly inputId: string; readonly backendField: string; readonly logicalReference: string }>;
  readonly parameterMappings: ReadonlyArray<{ readonly parameterId: string; readonly backendField: string; readonly value: unknown }>;
  readonly outputExpectations: ReadonlyArray<{ readonly outputId: string; readonly backendField: string }>;
}): ImageManipulationTranslationRequest {
  return {
    contractVersion: ImageManipulationTranslationContractsSchemaVersion,
    translationRequestId: "translation:req-1",
    runId: "run-1",
    workspaceId: "workspace-1",
    requestedAt: "2026-04-08T18:00:00.000Z",
    authoritative: {
      workflow: {
        workflowId: "workflow-1",
        workflowLineageId: "workflow-lineage-1",
        workflowVersionTag: "1.0.0",
        workflowRevision: 1,
        operationKind: input.operationKind,
        backendTranslation: {
          translatorId: "adapter.comfyui.image-manipulation",
          contractVersion: "1.0.0",
          templateId: input.templateId,
          templateVersion: "v1",
          inputBindings: input.slotBindings.map((entry) => Object.freeze({
            inputId: entry.inputId,
            backendField: entry.backendField,
          })),
          parameterBindings: input.parameterMappings.map((entry) => Object.freeze({
            parameterId: entry.parameterId,
            backendField: entry.backendField,
          })),
          outputBindings: input.outputExpectations.map((entry) => Object.freeze({
            outputId: entry.outputId,
            backendField: entry.backendField,
          })),
        },
      },
      system: {
        systemId: "system-1",
        workflowBinding: {
          workflowId: "workflow-1",
          workflowLineageId: "workflow-lineage-1",
          workflowVersionTag: "1.0.0",
          workflowRevision: 1,
          requiredInputIds: input.slotBindings.map((entry) => entry.inputId),
          requiredParameterIds: input.parameterMappings.map((entry) => entry.parameterId),
          requiredOutputIds: input.outputExpectations.map((entry) => entry.outputId),
        },
        parameterBaseline: {
          values: Object.freeze({}),
          profileReferences: Object.freeze([]),
        },
      },
    },
    templateResolution: {
      translatorId: "adapter.comfyui.image-manipulation",
      contractVersion: "1.0.0",
      templateId: input.templateId,
      templateVersion: "v1",
      adapterFamily: "adapter.comfyui.image-manipulation",
      operationTypeKey: `operation.${input.operationKind}`,
    },
    slotBindings: input.slotBindings.map((entry, index) => Object.freeze({
      bindingId: `slot-${index + 1}`,
      inputId: entry.inputId,
      backendField: entry.backendField,
      logicalReference: entry.logicalReference,
      sourceKind: "input-asset",
      required: true,
    })),
    parameterMappings: input.parameterMappings.map((entry) => Object.freeze({
      parameterId: entry.parameterId,
      backendField: entry.backendField,
      value: entry.value,
      source: "runtime-override",
    })),
    outputExpectations: input.outputExpectations.map((entry) => Object.freeze({
      outputId: entry.outputId,
      backendField: entry.backendField,
      required: true,
      allowsMultiple: false,
      logicalTargetReference: `dataset-instance://${entry.outputId}-target`,
    })),
    capabilityRequirements: {
      requiredCapabilities: ["operation:image"],
      preferredBackendFamily: "backend-family.comfyui.image-manipulation",
    },
  };
}

describe("ComfyImageManipulationTemplateTranslationAdapter", () => {
  it("translates image-to-image restyle template into a ComfyUI-ready request payload", async () => {
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter({
      now: () => new Date("2026-04-08T18:10:00.000Z"),
    });
    const result = await adapter.translateToBackendPayload(createBaseRequest({
      templateId: "image-template:image-to-image-restyle:v1",
      operationKind: "image-to-image",
      slotBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        logicalReference: "asset://image/source-1",
      }],
      parameterMappings: [{
        parameterId: "prompt",
        backendField: "parameters.prompt",
        value: "Restyle this portrait with softer cinematic lighting.",
      }, {
        parameterId: "variationStrength",
        backendField: "parameters.variation-strength",
        value: 0.4,
      }],
      outputExpectations: [{
        outputId: "generatedImage",
        backendField: "outputs.generated-image",
      }],
    }));

    expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (result.status === ImageManipulationTranslationStatuses.succeeded) {
      expect(result.executionPayload.operationKind).toBe("image-to-image");
      expect(result.executionPayload.inputs["inputs.source-image"]).toBe("asset://image/source-1");
      const comfyRequest = result.executionPayload.inputs["comfy.request"] as {
        readonly client_id: string;
        readonly prompt: Record<string, { readonly class_type: string }>;
      };
      expect(comfyRequest.client_id).toBe("run-1");
      expect(comfyRequest.prompt["6"]?.class_type).toBe("KSampler");
      expect(result.executionPayload.parameters["parameters.variation-strength"]).toBe(0.4);
    }
  });

  it("translates enhance/upscale template with scale-factor mapping", async () => {
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();
    const result = await adapter.translateToBackendPayload(createBaseRequest({
      templateId: "image-template:enhance-upscale:v1",
      operationKind: "enhance-upscale",
      slotBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        logicalReference: "asset://image/source-upscale",
      }],
      parameterMappings: [{
        parameterId: "scaleFactor",
        backendField: "parameters.scale-factor",
        value: 3,
      }],
      outputExpectations: [{
        outputId: "enhancedImage",
        backendField: "outputs.enhanced-image",
      }],
    }));

    expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (result.status === ImageManipulationTranslationStatuses.succeeded) {
      const comfyRequest = result.executionPayload.inputs["comfy.request"] as {
        readonly prompt: Record<string, { readonly class_type: string; readonly inputs: Record<string, unknown> }>;
      };
      expect(comfyRequest.prompt["2"]?.class_type).toBe("ImageScaleBy");
      expect(comfyRequest.prompt["2"]?.inputs.scale_by).toBe(3);
    }
  });

  it("translates mask-guided template and applies preserve-unmasked behavior", async () => {
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();
    const result = await adapter.translateToBackendPayload(createBaseRequest({
      templateId: "image-template:mask-guided-edit:v1",
      operationKind: "mask-guided-edit",
      slotBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        logicalReference: "asset://image/source-mask",
      }, {
        inputId: "maskImage",
        backendField: "inputs.mask-image",
        logicalReference: "asset://image/mask-1",
      }],
      parameterMappings: [{
        parameterId: "prompt",
        backendField: "parameters.prompt",
        value: "Replace the masked area with a polished red ceramic cup.",
      }, {
        parameterId: "preserveUnmaskedAreas",
        backendField: "parameters.preserve-unmasked-areas",
        value: true,
      }],
      outputExpectations: [{
        outputId: "editedImage",
        backendField: "outputs.edited-image",
      }],
    }));

    expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (result.status === ImageManipulationTranslationStatuses.succeeded) {
      const comfyRequest = result.executionPayload.inputs["comfy.request"] as {
        readonly prompt: Record<string, { readonly class_type: string; readonly inputs: Record<string, unknown> }>;
      };
      expect(comfyRequest.prompt["7"]?.class_type).toBe("SetLatentNoiseMask");
      expect(comfyRequest.prompt["8"]?.inputs.denoise).toBe(0.35);
    }
  });

  it("fails with structured diagnostics for unsupported template ids", async () => {
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();
    const result = await adapter.translateToBackendPayload(createBaseRequest({
      templateId: "image-template:unknown:v1",
      operationKind: "image-to-image",
      slotBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        logicalReference: "asset://image/source",
      }],
      parameterMappings: [{
        parameterId: "prompt",
        backendField: "parameters.prompt",
        value: "test",
      }],
      outputExpectations: [{
        outputId: "generatedImage",
        backendField: "outputs.generated-image",
      }],
    }));

    expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
    if (result.status === ImageManipulationTranslationStatuses.failed) {
      expect(result.diagnostics.some((entry) => entry.code === "unsupported-template-id")).toBeTrue();
      expect(result.metadata.diagnosticsSummary.blockingCount).toBeGreaterThan(0);
    }
  });

  it("fails with structured diagnostics when required mappings are missing", async () => {
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter();
    const request = createBaseRequest({
      templateId: "image-template:mask-guided-edit:v1",
      operationKind: "mask-guided-edit",
      slotBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        logicalReference: "asset://image/source-mask",
      }],
      parameterMappings: [{
        parameterId: "prompt",
        backendField: "parameters.prompt",
        value: "Replace masked region.",
      }],
      outputExpectations: [{
        outputId: "editedImage",
        backendField: "outputs.edited-image",
      }],
    });

    const result = await adapter.translateToBackendPayload(request);
    expect(result.status).toBe(ImageManipulationTranslationStatuses.failed);
    if (result.status === ImageManipulationTranslationStatuses.failed) {
      expect(result.diagnostics.some((entry) => entry.code === "missing-required-slot-binding")).toBeTrue();
    }
  });
});
