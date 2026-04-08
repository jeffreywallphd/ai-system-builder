import { describe, expect, it } from "bun:test";
import {
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
});

