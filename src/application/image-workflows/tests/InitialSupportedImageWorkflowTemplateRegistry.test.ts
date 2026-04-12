import { describe, expect, it } from "bun:test";
import {
  InitialImageWorkflowOperationCapabilities,
  InitialImageWorkflowTemplateBackendFamilies,
  InitialImageWorkflowTemplateFamilyIds,
  InitialSupportedImageWorkflowTemplateSet,
  InitialSupportedImageWorkflowTemplateRegistry,
  createInitialSupportedImageWorkflowTemplateRegistry,
} from "../InitialSupportedImageWorkflowTemplateRegistry";

describe("InitialSupportedImageWorkflowTemplateRegistry", () => {
  it("registers the initial supported workflow template set with stable operation coverage", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const templates = registry.list();

    expect(templates).toHaveLength(3);
    expect(templates.map((entry) => entry.operationKind).sort()).toEqual([
      "enhance-upscale",
      "image-to-image",
      "mask-guided-edit",
    ]);
  });

  it("supports template discovery by family id and operation kind", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const maskGuided = registry.getByTemplateFamilyId(InitialImageWorkflowTemplateFamilyIds.maskGuidedEdit);

    expect(maskGuided?.operationKind).toBe("mask-guided-edit");
    expect(maskGuided?.minimumRequirements.inputSlots.map((slot) => slot.kind).sort()).toEqual([
      "mask-image",
      "source-image",
    ]);

    const enhance = registry.getByOperationKind("enhance-upscale");
    expect(enhance?.templateFamilyId).toBe(InitialImageWorkflowTemplateFamilyIds.enhanceUpscale);
    expect(enhance?.minimumRequirements.outputExpectations[0]?.outputId).toBe("enhancedImage");
    expect(enhance?.translation.translationKey).toBe("image-template.translation.enhance-upscale.v1");
    expect(enhance?.display.title).toBe("Enhance/upscale");
  });

  it("exposes supported-operation checks and rejects duplicate registrations", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    expect(registry.isOperationSupported("image-to-image")).toBeTrue();
    expect(registry.isOperationSupported("batch-transform")).toBeFalse();

    expect(() => new InitialSupportedImageWorkflowTemplateRegistry([
      ...registry.list(),
      {
        ...registry.list()[0]!,
        templateFamilyId: "image-template:image-to-image-restyle:v1",
      },
    ])).toThrow("Duplicate image workflow template family id");
  });

  it("provides translation-ready metadata for each supported template without leaking backend graph details", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const templates = registry.list();

    for (const template of templates) {
      expect(template.translation.translationKey.length).toBeGreaterThan(0);
      expect(template.translation.adapterFamily).toBe("adapter.comfyui.image-manipulation");
      expect(template.translation.operationTypeKey.startsWith("operation.")).toBeTrue();
      expect(template.translation.inputMappings.length).toBeGreaterThan(0);
      expect(template.translation.outputMappings.length).toBeGreaterThan(0);
      expect(template.translation.translationKey.includes("{")).toBeFalse();
      expect(template.translation.translationKey.includes("}")).toBeFalse();
      expect(template.translation.translationKey.includes("raw-graph")).toBeFalse();
    }
  });

  it("provides structured compatibility metadata for capability and backend-family readiness checks", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const restyle = registry.getByOperationKind("image-to-image");
    const masked = registry.getByOperationKind("mask-guided-edit");

    expect(restyle?.compatibility.requiredOperationCapability).toBe(
      InitialImageWorkflowOperationCapabilities.imageToImage,
    );
    expect(restyle?.compatibility.requiredInputKinds).toEqual(["source-image"]);
    expect(restyle?.compatibility.requiredOutputKinds).toEqual(["generated-image"]);
    expect(restyle?.compatibility.translationBackendFamilies).toEqual([
      InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation,
    ]);
    expect(restyle?.compatibility.readinessChecks.translationBackendFamily).toBeTrue();

    expect(masked?.compatibility.requiredInputKinds.sort()).toEqual(["mask-image", "source-image"]);
  });

  it("resolves and evaluates compatibility readiness for later validation/node/translation consumers", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const compatibility = registry.resolveCompatibilityMetadataForOperationKind("enhance-upscale");

    expect(compatibility?.requiredOperationCapability).toBe(
      InitialImageWorkflowOperationCapabilities.enhanceUpscale,
    );
    expect(compatibility?.translationBackendFamilies).toEqual([
      InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation,
    ]);

    const ready = registry.evaluateCompatibilityReadinessForOperationKind({
      operationKind: "enhance-upscale",
      availableOperationCapabilities: [InitialImageWorkflowOperationCapabilities.enhanceUpscale],
      availableInputKinds: ["source-image"],
      availableOutputKinds: ["generated-image"],
      availableTranslationBackendFamilies: [InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation],
    });
    expect(ready.compatible).toBeTrue();
    expect(ready.issues).toEqual([]);

    const missing = registry.evaluateCompatibilityReadinessForOperationKind({
      operationKind: "enhance-upscale",
      availableOperationCapabilities: [],
      availableInputKinds: [],
      availableOutputKinds: ["generated-image"],
      availableTranslationBackendFamilies: [],
    });
    expect(missing.compatible).toBeFalse();
    expect(missing.issues.some((issue) => issue.code === "required-operation-capability-missing")).toBeTrue();
    expect(missing.issues.some((issue) => issue.code === "required-input-kind-missing")).toBeTrue();
    expect(missing.issues.some((issue) => issue.code === "required-translation-backend-family-missing")).toBeTrue();
  });

  it("provides centralized defaults, guidance, and reusable presets for supported templates", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const restyle = registry.getByOperationKind("image-to-image");
    const upscale = registry.getByOperationKind("enhance-upscale");
    const masked = registry.getByOperationKind("mask-guided-edit");

    expect(restyle?.configuration.defaults.parameterValues.variationStrength).toBe(0.45);
    expect(restyle?.configuration.parameterGuidance.map((entry) => entry.parameterId).sort()).toEqual([
      "prompt",
      "variationStrength",
    ]);
    expect(restyle?.configuration.presets.length).toBeGreaterThan(0);

    expect(upscale?.configuration.defaults.parameterValues.scaleFactor).toBe(2);
    expect(upscale?.configuration.parameterGuidance[0]?.guardrails?.maximum).toBe(4);

    expect(masked?.configuration.defaults.parameterValues.preserveUnmaskedAreas).toBeTrue();
    expect(masked?.configuration.parameterGuidance[1]?.guardrails?.allowedValues).toEqual([true, false]);
  });

  it("resolves defaults and presets for template-driven parameter initialization", () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();

    const defaultUpscale = registry.resolveDefaultParameterValuesForOperationKind("enhance-upscale");
    expect(defaultUpscale?.source).toBe("defaults");
    expect(defaultUpscale?.parameterValues.scaleFactor).toBe(2);

    const boldRestyle = registry.resolveParameterValuesForOperationKind({
      operationKind: "image-to-image",
      presetId: "bold-restyle",
    });
    expect(boldRestyle?.source).toBe("preset");
    expect(boldRestyle?.presetId).toBe("bold-restyle");
    expect(boldRestyle?.parameterValues.variationStrength).toBe(0.7);
    expect(typeof boldRestyle?.parameterValues.prompt).toBe("string");

    const presets = registry.listPresetsForOperationKind("mask-guided-edit");
    expect(presets.map((preset) => preset.presetId).sort()).toEqual([
      "creative-replace",
      "precise-retouch",
    ]);

    expect(() => registry.resolveParameterValuesForOperationKind({
      operationKind: "enhance-upscale",
      presetId: "missing-preset",
    })).toThrow("does not contain preset");
  });

  it("rejects template registration when translation metadata drifts from required template definitions", () => {
    const invalidTemplate = {
      ...InitialSupportedImageWorkflowTemplateSet[0]!,
      templateFamilyId: "image-template:image-to-image-restyle:v1",
      translation: {
        ...InitialSupportedImageWorkflowTemplateSet[0]!.translation,
        inputMappings: [{
          inputId: "nonExistentInput",
          translationKey: "inputs.bad",
          required: true,
        }],
      },
    } as const;

    expect(() => new InitialSupportedImageWorkflowTemplateRegistry([
      invalidTemplate,
      {
        ...InitialSupportedImageWorkflowTemplateSet[1]!,
      },
      {
        ...InitialSupportedImageWorkflowTemplateSet[2]!,
      },
    ])).toThrow("references unknown id");
  });

  it("rejects template registration when compatibility metadata drifts from required contract requirements", () => {
    const invalidTemplate = {
      ...InitialSupportedImageWorkflowTemplateSet[2]!,
      compatibility: {
        ...InitialSupportedImageWorkflowTemplateSet[2]!.compatibility,
        requiredInputKinds: ["source-image"],
      },
    } as const;

    expect(() => new InitialSupportedImageWorkflowTemplateRegistry([
      {
        ...InitialSupportedImageWorkflowTemplateSet[0]!,
      },
      {
        ...InitialSupportedImageWorkflowTemplateSet[1]!,
      },
      invalidTemplate,
    ])).toThrow("compatibility.requiredInputKinds must include 'mask-image'");
  });

  it("rejects template registration when defaults and presets violate parameter requirements", () => {
    const invalidTemplate = {
      ...InitialSupportedImageWorkflowTemplateSet[1]!,
      configuration: {
        ...InitialSupportedImageWorkflowTemplateSet[1]!.configuration,
        defaults: {
          ...InitialSupportedImageWorkflowTemplateSet[1]!.configuration.defaults,
          parameterValues: {
            scaleFactor: "not-a-number",
          },
        },
      },
    } as const;

    expect(() => new InitialSupportedImageWorkflowTemplateRegistry([
      {
        ...InitialSupportedImageWorkflowTemplateSet[0]!,
      },
      invalidTemplate,
      {
        ...InitialSupportedImageWorkflowTemplateSet[2]!,
      },
    ])).toThrow("must be a number");
  });
});

