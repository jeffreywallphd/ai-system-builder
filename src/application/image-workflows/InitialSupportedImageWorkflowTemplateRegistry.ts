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

export interface InitialImageWorkflowTemplateDisplayMetadata {
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
}

export interface InitialImageWorkflowTemplateCapabilityHints {
  readonly supportsBatchInput: boolean;
  readonly requiresMaskInput: boolean;
  readonly generatesImageCollection: boolean;
}

export interface InitialImageWorkflowTemplateInputTranslationMapping {
  readonly inputId: string;
  readonly translationKey: string;
  readonly required: boolean;
}

export interface InitialImageWorkflowTemplateParameterTranslationMapping {
  readonly parameterId: string;
  readonly translationKey: string;
  readonly required: boolean;
}

export interface InitialImageWorkflowTemplateOutputTranslationMapping {
  readonly outputId: string;
  readonly translationKey: string;
  readonly required: boolean;
}

export interface InitialImageWorkflowTemplateTranslationMetadata {
  readonly translationKey: string;
  readonly adapterFamily: string;
  readonly operationTypeKey: string;
  readonly requiredAssetRoles: ReadonlyArray<string>;
  readonly capabilityHints: InitialImageWorkflowTemplateCapabilityHints;
  readonly inputMappings: ReadonlyArray<InitialImageWorkflowTemplateInputTranslationMapping>;
  readonly parameterMappings: ReadonlyArray<InitialImageWorkflowTemplateParameterTranslationMapping>;
  readonly outputMappings: ReadonlyArray<InitialImageWorkflowTemplateOutputTranslationMapping>;
}

export interface InitialImageWorkflowTemplateDefinition {
  readonly templateFamilyId: InitialImageWorkflowTemplateFamilyId;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly display: InitialImageWorkflowTemplateDisplayMetadata;
  readonly translation: InitialImageWorkflowTemplateTranslationMetadata;
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
    display: Object.freeze({
      ...template.display,
    }),
    translation: Object.freeze({
      ...template.translation,
      requiredAssetRoles: Object.freeze([...template.translation.requiredAssetRoles]),
      capabilityHints: Object.freeze({
        ...template.translation.capabilityHints,
      }),
      inputMappings: Object.freeze(template.translation.inputMappings.map((mapping) => Object.freeze({ ...mapping }))),
      parameterMappings: Object.freeze(
        template.translation.parameterMappings.map((mapping) => Object.freeze({ ...mapping })),
      ),
      outputMappings: Object.freeze(template.translation.outputMappings.map((mapping) => Object.freeze({ ...mapping }))),
    }),
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
    display: {
      title: "Image-to-image restyle",
      summary: "Prompt-driven variation and restyle from one source image.",
      rationale: "High-value baseline operation that validates prompt + source-image translation and output persistence seams.",
    },
    translation: {
      translationKey: "image-template.translation.image-to-image-restyle.v1",
      adapterFamily: "adapter.comfyui.image-manipulation",
      operationTypeKey: "operation.image-to-image",
      requiredAssetRoles: ["source-image"],
      capabilityHints: {
        supportsBatchInput: false,
        requiresMaskInput: false,
        generatesImageCollection: false,
      },
      inputMappings: [{
        inputId: "sourceImage",
        translationKey: "inputs.source-image",
        required: true,
      }],
      parameterMappings: [{
        parameterId: "prompt",
        translationKey: "parameters.prompt",
        required: true,
      }, {
        parameterId: "variationStrength",
        translationKey: "parameters.variation-strength",
        required: true,
      }],
      outputMappings: [{
        outputId: "generatedImage",
        translationKey: "outputs.generated-image",
        required: true,
      }],
    },
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
    display: {
      title: "Enhance/upscale",
      summary: "Single-image enhancement and resolution increase with bounded controls.",
      rationale: "Delivers practical quality-improvement output without introducing broad multi-stage graph complexity.",
    },
    translation: {
      translationKey: "image-template.translation.enhance-upscale.v1",
      adapterFamily: "adapter.comfyui.image-manipulation",
      operationTypeKey: "operation.enhance-upscale",
      requiredAssetRoles: ["source-image"],
      capabilityHints: {
        supportsBatchInput: false,
        requiresMaskInput: false,
        generatesImageCollection: false,
      },
      inputMappings: [{
        inputId: "sourceImage",
        translationKey: "inputs.source-image",
        required: true,
      }],
      parameterMappings: [{
        parameterId: "scaleFactor",
        translationKey: "parameters.scale-factor",
        required: true,
      }],
      outputMappings: [{
        outputId: "enhancedImage",
        translationKey: "outputs.enhanced-image",
        required: true,
      }],
    },
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
    display: {
      title: "Mask-guided edit",
      summary: "Localized edits constrained by a user-supplied mask image.",
      rationale: "Adds a structurally realistic targeted-edit path for production use while keeping scope bounded to one source and one mask.",
    },
    translation: {
      translationKey: "image-template.translation.mask-guided-edit.v1",
      adapterFamily: "adapter.comfyui.image-manipulation",
      operationTypeKey: "operation.mask-guided-edit",
      requiredAssetRoles: ["source-image", "mask-image"],
      capabilityHints: {
        supportsBatchInput: false,
        requiresMaskInput: true,
        generatesImageCollection: false,
      },
      inputMappings: [{
        inputId: "sourceImage",
        translationKey: "inputs.source-image",
        required: true,
      }, {
        inputId: "maskImage",
        translationKey: "inputs.mask-image",
        required: true,
      }],
      parameterMappings: [{
        parameterId: "prompt",
        translationKey: "parameters.prompt",
        required: true,
      }, {
        parameterId: "preserveUnmaskedAreas",
        translationKey: "parameters.preserve-unmasked-areas",
        required: false,
      }],
      outputMappings: [{
        outputId: "editedImage",
        translationKey: "outputs.edited-image",
        required: true,
      }],
    },
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
      assertTemplateDefinitionIsTranslationReady(definition);
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

function assertTemplateDefinitionIsTranslationReady(template: InitialImageWorkflowTemplateDefinition): void {
  assertRequiredString(template.templateFamilyId, "templateFamilyId");
  assertRequiredString(template.operationKind, "operationKind");
  assertRequiredString(template.display.title, "display.title");
  assertRequiredString(template.display.summary, "display.summary");
  assertRequiredString(template.display.rationale, "display.rationale");

  assertRequiredString(template.translation.translationKey, "translation.translationKey");
  assertRequiredString(template.translation.adapterFamily, "translation.adapterFamily");
  assertRequiredString(template.translation.operationTypeKey, "translation.operationTypeKey");
  assertUniqueValues(template.translation.requiredAssetRoles, "translation.requiredAssetRoles");

  assertTranslationMappingsMatchRequirements({
    template,
    inputMappings: template.translation.inputMappings,
    requiredItems: template.minimumRequirements.inputSlots.map((slot) => ({
      id: slot.inputId,
      required: slot.required,
    })),
    mappingIdField: "inputId",
    mappingRequiredField: "required",
    label: "input",
  });
  assertTranslationMappingsMatchRequirements({
    template,
    inputMappings: template.translation.parameterMappings,
    requiredItems: template.minimumRequirements.parameterSpecifications.map((parameter) => ({
      id: parameter.parameterId,
      required: parameter.required,
    })),
    mappingIdField: "parameterId",
    mappingRequiredField: "required",
    label: "parameter",
  });
  assertTranslationMappingsMatchRequirements({
    template,
    inputMappings: template.translation.outputMappings,
    requiredItems: template.minimumRequirements.outputExpectations.map((output) => ({
      id: output.outputId,
      required: output.required,
    })),
    mappingIdField: "outputId",
    mappingRequiredField: "required",
    label: "output",
  });

  const expectedRequiredAssetRoles = new Set(
    template.minimumRequirements.inputSlots
      .filter((slot) => slot.required && slot.valueType.startsWith("image-asset-reference"))
      .map((slot) => slot.kind),
  );
  for (const requiredRole of expectedRequiredAssetRoles) {
    if (!template.translation.requiredAssetRoles.includes(requiredRole)) {
      throw new Error(
        `Template '${template.templateFamilyId}' translation.requiredAssetRoles must include '${requiredRole}'.`,
      );
    }
  }
}

function assertRequiredString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Initial template ${field} is required.`);
  }
}

function assertUniqueValues(values: ReadonlyArray<string>, field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assertRequiredString(value, field);
    if (seen.has(value)) {
      throw new Error(`Initial template ${field} must be unique; duplicate '${value}'.`);
    }
    seen.add(value);
  }
}

function assertTranslationMappingsMatchRequirements<TMapping extends Record<string, string | boolean>, TRequired extends {
  readonly id: string;
  readonly required: boolean;
}>(input: {
  readonly template: InitialImageWorkflowTemplateDefinition;
  readonly inputMappings: ReadonlyArray<TMapping>;
  readonly requiredItems: ReadonlyArray<TRequired>;
  readonly mappingIdField: keyof TMapping;
  readonly mappingRequiredField: keyof TMapping;
  readonly label: string;
}): void {
  const knownIds = new Map<string, boolean>();
  for (const item of input.requiredItems) {
    knownIds.set(item.id, item.required);
  }

  const mappedIds = new Set<string>();
  for (const mapping of input.inputMappings) {
    const mappedId = mapping[input.mappingIdField];
    const mappedRequired = mapping[input.mappingRequiredField];
    const translationKey = mapping.translationKey;
    if (typeof mappedId !== "string" || mappedId.trim().length === 0) {
      throw new Error(`Template '${input.template.templateFamilyId}' ${input.label} translation mapping id is required.`);
    }
    if (typeof translationKey !== "string" || translationKey.trim().length === 0) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.label} '${mappedId}' translationKey is required.`,
      );
    }
    if (typeof mappedRequired !== "boolean") {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.label} '${mappedId}' required flag must be boolean.`,
      );
    }
    if (!knownIds.has(mappedId)) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.label} mapping references unknown id '${mappedId}'.`,
      );
    }
    if (mappedIds.has(mappedId)) {
      throw new Error(`Template '${input.template.templateFamilyId}' has duplicate ${input.label} mapping '${mappedId}'.`);
    }

    const required = knownIds.get(mappedId);
    if (required !== mappedRequired) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.label} mapping '${mappedId}' required flag must match minimum requirements.`,
      );
    }
    mappedIds.add(mappedId);
  }

  for (const [requiredId, required] of knownIds.entries()) {
    if (required && !mappedIds.has(requiredId)) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' missing required ${input.label} mapping '${requiredId}'.`,
      );
    }
  }
}

