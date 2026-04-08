import { describe, expect, it } from "bun:test";
import {
  InitialImageWorkflowTemplateFamilyIds,
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
});

