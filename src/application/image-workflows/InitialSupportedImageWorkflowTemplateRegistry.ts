import type {
  ImageWorkflowInputSlotKind,
  ImageWorkflowOperationKind,
  ImageWorkflowOutputKind,
  ImageWorkflowValueType,
} from "@domain/image-workflows/ImageWorkflowDomain";
import type {
  ImageWorkflowParameterSemanticMeaning,
  ImageWorkflowParameterValueKind,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";

export const InitialImageWorkflowTemplateFamilyIds = Object.freeze({
  imageToImageRestyle: "image-template:image-to-image-restyle:v1",
  enhanceUpscale: "image-template:enhance-upscale:v1",
  maskGuidedEdit: "image-template:mask-guided-edit:v1",
});

export type InitialImageWorkflowTemplateFamilyId =
  typeof InitialImageWorkflowTemplateFamilyIds[keyof typeof InitialImageWorkflowTemplateFamilyIds];

export interface InitialImageWorkflowTemplateInputRequirement {
  readonly inputId: string;
  readonly kind: ImageWorkflowInputSlotKind;
  readonly valueType: ImageWorkflowValueType;
  readonly required: boolean;
  readonly allowsMultiple: boolean;
}

export interface InitialImageWorkflowTemplateParameterRequirement {
  readonly parameterId: string;
  readonly valueKind: ImageWorkflowParameterValueKind;
  readonly semanticMeaning: ImageWorkflowParameterSemanticMeaning;
  readonly required: boolean;
}

export interface InitialImageWorkflowTemplateOutputRequirement {
  readonly outputId: string;
  readonly kind: ImageWorkflowOutputKind;
  readonly valueType: ImageWorkflowValueType;
  readonly required: boolean;
  readonly allowsMultiple: boolean;
}

export interface InitialImageWorkflowTemplateDefinition {
  readonly templateFamilyId: InitialImageWorkflowTemplateFamilyId;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
  readonly minimumRequirements: {
    readonly inputSlots: ReadonlyArray<InitialImageWorkflowTemplateInputRequirement>;
    readonly parameterSpecifications: ReadonlyArray<InitialImageWorkflowTemplateParameterRequirement>;
    readonly outputExpectations: ReadonlyArray<InitialImageWorkflowTemplateOutputRequirement>;
  };
}

function freezeTemplate(
  template: InitialImageWorkflowTemplateDefinition,
): InitialImageWorkflowTemplateDefinition {
  return Object.freeze({
    ...template,
    minimumRequirements: Object.freeze({
      inputSlots: Object.freeze(template.minimumRequirements.inputSlots.map((slot) => Object.freeze({ ...slot }))),
      parameterSpecifications: Object.freeze(
        template.minimumRequirements.parameterSpecifications.map((parameter) => Object.freeze({ ...parameter })),
      ),
      outputExpectations: Object.freeze(
        template.minimumRequirements.outputExpectations.map((output) => Object.freeze({ ...output })),
      ),
    }),
  });
}

export const InitialSupportedImageWorkflowTemplateSet: ReadonlyArray<InitialImageWorkflowTemplateDefinition> = Object.freeze([
  freezeTemplate({
    templateFamilyId: InitialImageWorkflowTemplateFamilyIds.imageToImageRestyle,
    operationKind: "image-to-image",
    title: "Image-to-image restyle",
    summary: "Prompt-driven variation and restyle from one source image.",
    rationale: "High-value baseline operation that validates prompt + source-image translation and output persistence seams.",
    minimumRequirements: {
      inputSlots: [{
        inputId: "sourceImage",
        kind: "source-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
      parameterSpecifications: [{
        parameterId: "prompt",
        valueKind: "text",
        semanticMeaning: "prompt",
        required: true,
      }, {
        parameterId: "variationStrength",
        valueKind: "float",
        semanticMeaning: "variation-strength",
        required: true,
      }],
      outputExpectations: [{
        outputId: "generatedImage",
        kind: "generated-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
    },
  }),
  freezeTemplate({
    templateFamilyId: InitialImageWorkflowTemplateFamilyIds.enhanceUpscale,
    operationKind: "enhance-upscale",
    title: "Enhance/upscale",
    summary: "Single-image enhancement and resolution increase with bounded controls.",
    rationale: "Delivers practical quality-improvement output without introducing broad multi-stage graph complexity.",
    minimumRequirements: {
      inputSlots: [{
        inputId: "sourceImage",
        kind: "source-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
      parameterSpecifications: [{
        parameterId: "scaleFactor",
        valueKind: "float",
        semanticMeaning: "custom",
        required: true,
      }],
      outputExpectations: [{
        outputId: "enhancedImage",
        kind: "generated-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
    },
  }),
  freezeTemplate({
    templateFamilyId: InitialImageWorkflowTemplateFamilyIds.maskGuidedEdit,
    operationKind: "mask-guided-edit",
    title: "Mask-guided edit",
    summary: "Localized edits constrained by a user-supplied mask image.",
    rationale: "Adds a structurally realistic targeted-edit path for production use while keeping scope bounded to one source and one mask.",
    minimumRequirements: {
      inputSlots: [{
        inputId: "sourceImage",
        kind: "source-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }, {
        inputId: "maskImage",
        kind: "mask-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
      parameterSpecifications: [{
        parameterId: "prompt",
        valueKind: "text",
        semanticMeaning: "prompt",
        required: true,
      }, {
        parameterId: "preserveUnmaskedAreas",
        valueKind: "boolean",
        semanticMeaning: "custom",
        required: false,
      }],
      outputExpectations: [{
        outputId: "editedImage",
        kind: "generated-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
    },
  }),
]);

export class InitialSupportedImageWorkflowTemplateRegistry {
  private readonly templatesByFamilyId: ReadonlyMap<InitialImageWorkflowTemplateFamilyId, InitialImageWorkflowTemplateDefinition>;
  private readonly templatesByOperation: ReadonlyMap<ImageWorkflowOperationKind, InitialImageWorkflowTemplateDefinition>;

  public constructor(
    definitions: ReadonlyArray<InitialImageWorkflowTemplateDefinition> = InitialSupportedImageWorkflowTemplateSet,
  ) {
    const byFamilyId = new Map<InitialImageWorkflowTemplateFamilyId, InitialImageWorkflowTemplateDefinition>();
    const byOperation = new Map<ImageWorkflowOperationKind, InitialImageWorkflowTemplateDefinition>();

    for (const definition of definitions) {
      if (byFamilyId.has(definition.templateFamilyId)) {
        throw new Error(`Duplicate image workflow template family id '${definition.templateFamilyId}'.`);
      }
      if (byOperation.has(definition.operationKind)) {
        throw new Error(`Duplicate image workflow operation registration '${definition.operationKind}'.`);
      }
      byFamilyId.set(definition.templateFamilyId, definition);
      byOperation.set(definition.operationKind, definition);
    }

    this.templatesByFamilyId = byFamilyId;
    this.templatesByOperation = byOperation;
  }

  public list(): ReadonlyArray<InitialImageWorkflowTemplateDefinition> {
    return Object.freeze([...this.templatesByFamilyId.values()]);
  }

  public getByTemplateFamilyId(
    templateFamilyId: InitialImageWorkflowTemplateFamilyId,
  ): InitialImageWorkflowTemplateDefinition | undefined {
    return this.templatesByFamilyId.get(templateFamilyId);
  }

  public getByOperationKind(operationKind: ImageWorkflowOperationKind): InitialImageWorkflowTemplateDefinition | undefined {
    return this.templatesByOperation.get(operationKind);
  }

  public isOperationSupported(operationKind: ImageWorkflowOperationKind): boolean {
    return this.templatesByOperation.has(operationKind);
  }
}

export function createInitialSupportedImageWorkflowTemplateRegistry(): InitialSupportedImageWorkflowTemplateRegistry {
  return new InitialSupportedImageWorkflowTemplateRegistry();
}

