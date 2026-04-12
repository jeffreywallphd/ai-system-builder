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

export const InitialImageWorkflowTemplatePresetScopes = Object.freeze({
  platformDefault: "platform-default",
  workspaceShared: "workspace-shared",
  userPrivate: "user-private",
});

export type InitialImageWorkflowTemplatePresetScope =
  typeof InitialImageWorkflowTemplatePresetScopes[keyof typeof InitialImageWorkflowTemplatePresetScopes];

export const InitialImageWorkflowOperationCapabilities = Object.freeze({
  imageToImage: "image.workflow.operation.image-to-image.execute",
  enhanceUpscale: "image.workflow.operation.enhance-upscale.execute",
  maskGuidedEdit: "image.workflow.operation.mask-guided-edit.execute",
});

export type InitialImageWorkflowOperationCapability =
  typeof InitialImageWorkflowOperationCapabilities[keyof typeof InitialImageWorkflowOperationCapabilities] | (string & {});

export const InitialImageWorkflowTemplateBackendFamilies = Object.freeze({
  comfyUiImageManipulation: "backend-family.comfyui.image-manipulation",
});

export type InitialImageWorkflowTemplateBackendFamily =
  typeof InitialImageWorkflowTemplateBackendFamilies[keyof typeof InitialImageWorkflowTemplateBackendFamilies] | (string & {});

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

export interface InitialImageWorkflowTemplateParameterValueRecommendedRange {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly step?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly suggestedValues?: ReadonlyArray<string | number | boolean>;
}

export interface InitialImageWorkflowTemplateParameterValueGuardrails {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly allowEmpty?: boolean;
  readonly allowedValues?: ReadonlyArray<string | number | boolean>;
}

export interface InitialImageWorkflowTemplateParameterGuidance {
  readonly parameterId: string;
  readonly label: string;
  readonly helperText: string;
  readonly recommendedRange?: InitialImageWorkflowTemplateParameterValueRecommendedRange;
  readonly guardrails?: InitialImageWorkflowTemplateParameterValueGuardrails;
}

export interface InitialImageWorkflowTemplateDefaultParameterValues {
  readonly title: string;
  readonly summary: string;
  readonly parameterValues: Readonly<Record<string, unknown>>;
}

export interface InitialImageWorkflowTemplatePresetDefinition {
  readonly presetId: string;
  readonly scope: InitialImageWorkflowTemplatePresetScope;
  readonly title: string;
  readonly summary: string;
  readonly parameterValues: Readonly<Record<string, unknown>>;
}

export interface InitialImageWorkflowTemplateConfigurationMetadata {
  readonly defaults: InitialImageWorkflowTemplateDefaultParameterValues;
  readonly presets: ReadonlyArray<InitialImageWorkflowTemplatePresetDefinition>;
  readonly parameterGuidance: ReadonlyArray<InitialImageWorkflowTemplateParameterGuidance>;
}

export interface InitialImageWorkflowTemplateCompatibilityMetadata {
  readonly requiredOperationCapability: InitialImageWorkflowOperationCapability;
  readonly requiredInputKinds: ReadonlyArray<ImageWorkflowInputSlotKind>;
  readonly requiredOutputKinds: ReadonlyArray<ImageWorkflowOutputKind>;
  readonly translationBackendFamilies: ReadonlyArray<InitialImageWorkflowTemplateBackendFamily>;
  readonly readinessChecks: {
    readonly operationCapability: boolean;
    readonly inputKinds: boolean;
    readonly outputKinds: boolean;
    readonly translationBackendFamily: boolean;
  };
}

export interface InitialImageWorkflowTemplateDefinition {
  readonly templateFamilyId: InitialImageWorkflowTemplateFamilyId;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly display: InitialImageWorkflowTemplateDisplayMetadata;
  readonly compatibility: InitialImageWorkflowTemplateCompatibilityMetadata;
  readonly translation: InitialImageWorkflowTemplateTranslationMetadata;
  readonly configuration: InitialImageWorkflowTemplateConfigurationMetadata;
  readonly minimumRequirements: {
    readonly inputSlots: ReadonlyArray<InitialImageWorkflowTemplateInputRequirement>;
    readonly parameterSpecifications: ReadonlyArray<InitialImageWorkflowTemplateParameterRequirement>;
    readonly outputExpectations: ReadonlyArray<InitialImageWorkflowTemplateOutputRequirement>;
  };
}

export interface ResolvedImageWorkflowTemplateParameterValues {
  readonly templateFamilyId: InitialImageWorkflowTemplateFamilyId;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly source: "defaults" | "preset";
  readonly presetId?: string;
  readonly parameterValues: Readonly<Record<string, unknown>>;
}

export interface InitialImageWorkflowTemplateCompatibilityReadinessIssue {
  readonly code:
    | "operation-not-supported"
    | "required-operation-capability-missing"
    | "required-input-kind-missing"
    | "required-output-kind-missing"
    | "required-translation-backend-family-missing";
  readonly path: string;
  readonly message: string;
}

export interface InitialImageWorkflowTemplateCompatibilityReadinessResult {
  readonly templateFamilyId?: InitialImageWorkflowTemplateFamilyId;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<InitialImageWorkflowTemplateCompatibilityReadinessIssue>;
}

function freezeTemplate(
  template: InitialImageWorkflowTemplateDefinition,
): InitialImageWorkflowTemplateDefinition {
  return Object.freeze({
    ...template,
    display: Object.freeze({
      ...template.display,
    }),
    compatibility: Object.freeze({
      ...template.compatibility,
      requiredInputKinds: Object.freeze([...template.compatibility.requiredInputKinds]),
      requiredOutputKinds: Object.freeze([...template.compatibility.requiredOutputKinds]),
      translationBackendFamilies: Object.freeze([...template.compatibility.translationBackendFamilies]),
      readinessChecks: Object.freeze({
        ...template.compatibility.readinessChecks,
      }),
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
    configuration: Object.freeze({
      defaults: Object.freeze({
        ...template.configuration.defaults,
        parameterValues: Object.freeze({ ...template.configuration.defaults.parameterValues }),
      }),
      presets: Object.freeze(template.configuration.presets.map((preset) => Object.freeze({
        ...preset,
        parameterValues: Object.freeze({ ...preset.parameterValues }),
      }))),
      parameterGuidance: Object.freeze(template.configuration.parameterGuidance.map((entry) => Object.freeze({
        ...entry,
        recommendedRange: entry.recommendedRange
          ? Object.freeze({
            ...entry.recommendedRange,
            suggestedValues: entry.recommendedRange.suggestedValues
              ? Object.freeze([...entry.recommendedRange.suggestedValues])
              : undefined,
          })
          : undefined,
        guardrails: entry.guardrails
          ? Object.freeze({
            ...entry.guardrails,
            allowedValues: entry.guardrails.allowedValues
              ? Object.freeze([...entry.guardrails.allowedValues])
              : undefined,
          })
          : undefined,
      }))),
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
    compatibility: {
      requiredOperationCapability: InitialImageWorkflowOperationCapabilities.imageToImage,
      requiredInputKinds: ["source-image"],
      requiredOutputKinds: ["generated-image"],
      translationBackendFamilies: [InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation],
      readinessChecks: {
        operationCapability: true,
        inputKinds: true,
        outputKinds: true,
        translationBackendFamily: true,
      },
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
    configuration: {
      defaults: {
        title: "Balanced restyle",
        summary: "Good starting point for guided edits that preserve the original image composition.",
        parameterValues: {
          prompt: "Restyle this image while preserving its composition and core subject details.",
          variationStrength: 0.45,
        },
      },
      presets: [{
        presetId: "subtle-cleanup",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Subtle Cleanup",
        summary: "Small quality improvements and cleanup while keeping the original style mostly intact.",
        parameterValues: {
          prompt: "Clean up small artifacts, improve clarity, and keep the original style.",
          variationStrength: 0.25,
        },
      }, {
        presetId: "bold-restyle",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Bold Restyle",
        summary: "Stronger visual changes for exploratory variations.",
        parameterValues: {
          prompt: "Create a stronger visual restyle with noticeable artistic changes.",
          variationStrength: 0.7,
        },
      }],
      parameterGuidance: [{
        parameterId: "prompt",
        label: "Edit Direction",
        helperText: "Describe what should change, and keep instructions focused on visible image outcomes.",
        recommendedRange: {
          minLength: 20,
          maxLength: 260,
        },
        guardrails: {
          minLength: 5,
          maxLength: 800,
          allowEmpty: false,
        },
      }, {
        parameterId: "variationStrength",
        label: "Variation Strength",
        helperText: "Lower values keep the source image closer to original; higher values allow stronger restyling.",
        recommendedRange: {
          minimum: 0.25,
          maximum: 0.65,
          step: 0.05,
          suggestedValues: [0.25, 0.45, 0.65],
        },
        guardrails: {
          minimum: 0,
          maximum: 1,
        },
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
    compatibility: {
      requiredOperationCapability: InitialImageWorkflowOperationCapabilities.enhanceUpscale,
      requiredInputKinds: ["source-image"],
      requiredOutputKinds: ["generated-image"],
      translationBackendFamilies: [InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation],
      readinessChecks: {
        operationCapability: true,
        inputKinds: true,
        outputKinds: true,
        translationBackendFamily: true,
      },
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
    configuration: {
      defaults: {
        title: "Standard 2x",
        summary: "Balanced default for most web and screen uses.",
        parameterValues: {
          scaleFactor: 2,
        },
      },
      presets: [{
        presetId: "web-sharp-2x",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Web Sharp 2x",
        summary: "Reliable enhancement for online display where artifact control matters.",
        parameterValues: {
          scaleFactor: 2,
        },
      }, {
        presetId: "print-detail-3x",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Print Detail 3x",
        summary: "Higher detail target for print-ready derivatives.",
        parameterValues: {
          scaleFactor: 3,
        },
      }, {
        presetId: "max-detail-4x",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Max Detail 4x",
        summary: "Strong upscale for cases where larger dimensions are required.",
        parameterValues: {
          scaleFactor: 4,
        },
      }],
      parameterGuidance: [{
        parameterId: "scaleFactor",
        label: "Upscale Factor",
        helperText: "Higher factors increase output size and may increase runtime cost.",
        recommendedRange: {
          minimum: 2,
          maximum: 3,
          step: 1,
          suggestedValues: [2, 3, 4],
        },
        guardrails: {
          minimum: 1,
          maximum: 4,
        },
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
    compatibility: {
      requiredOperationCapability: InitialImageWorkflowOperationCapabilities.maskGuidedEdit,
      requiredInputKinds: ["source-image", "mask-image"],
      requiredOutputKinds: ["generated-image"],
      translationBackendFamilies: [InitialImageWorkflowTemplateBackendFamilies.comfyUiImageManipulation],
      readinessChecks: {
        operationCapability: true,
        inputKinds: true,
        outputKinds: true,
        translationBackendFamily: true,
      },
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
    configuration: {
      defaults: {
        title: "Precise Retouch",
        summary: "Conservative edits limited to masked regions.",
        parameterValues: {
          prompt: "Edit only the masked area and keep the surrounding image consistent.",
          preserveUnmaskedAreas: true,
        },
      },
      presets: [{
        presetId: "precise-retouch",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Precise Retouch",
        summary: "Small, controlled fixes while preserving untouched areas.",
        parameterValues: {
          prompt: "Retouch the masked area only and preserve surrounding details.",
          preserveUnmaskedAreas: true,
        },
      }, {
        presetId: "creative-replace",
        scope: InitialImageWorkflowTemplatePresetScopes.platformDefault,
        title: "Creative Replace",
        summary: "More assertive masked-region replacement with creative variation.",
        parameterValues: {
          prompt: "Replace the masked area with a creative but coherent new visual concept.",
          preserveUnmaskedAreas: false,
        },
      }],
      parameterGuidance: [{
        parameterId: "prompt",
        label: "Masked Edit Direction",
        helperText: "Describe only what should change inside the masked area.",
        recommendedRange: {
          minLength: 15,
          maxLength: 220,
        },
        guardrails: {
          minLength: 5,
          maxLength: 800,
          allowEmpty: false,
        },
      }, {
        parameterId: "preserveUnmaskedAreas",
        label: "Protect Unmasked Areas",
        helperText: "Keep this enabled for targeted edits; disable for more global blending behavior.",
        recommendedRange: {
          suggestedValues: [true],
        },
        guardrails: {
          allowedValues: [true, false],
        },
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

  public listPresetsForOperationKind(operationKind: ImageWorkflowOperationKind): ReadonlyArray<InitialImageWorkflowTemplatePresetDefinition> {
    const template = this.templatesByOperation.get(operationKind);
    if (!template) {
      return Object.freeze([]);
    }
    return template.configuration.presets;
  }

  public resolveCompatibilityMetadataForOperationKind(
    operationKind: ImageWorkflowOperationKind,
  ): InitialImageWorkflowTemplateCompatibilityMetadata | undefined {
    return this.templatesByOperation.get(operationKind)?.compatibility;
  }

  public evaluateCompatibilityReadinessForOperationKind(input: {
    readonly operationKind: ImageWorkflowOperationKind;
    readonly availableOperationCapabilities: ReadonlyArray<string>;
    readonly availableInputKinds: ReadonlyArray<ImageWorkflowInputSlotKind>;
    readonly availableOutputKinds: ReadonlyArray<ImageWorkflowOutputKind>;
    readonly availableTranslationBackendFamilies: ReadonlyArray<string>;
  }): InitialImageWorkflowTemplateCompatibilityReadinessResult {
    const template = this.templatesByOperation.get(input.operationKind);
    if (!template) {
      return Object.freeze({
        operationKind: input.operationKind,
        compatible: false,
        issues: Object.freeze([{
          code: "operation-not-supported",
          path: "operationKind",
          message: `Operation '${input.operationKind}' is outside the initial supported image workflow template set.`,
        }]),
      });
    }

    const compatibility = template.compatibility;
    const issues: InitialImageWorkflowTemplateCompatibilityReadinessIssue[] = [];
    const availableOperationCapabilities = new Set(input.availableOperationCapabilities.map((entry) => entry.trim()).filter(Boolean));
    const availableInputKinds = new Set(input.availableInputKinds);
    const availableOutputKinds = new Set(input.availableOutputKinds);
    const availableTranslationBackendFamilies = new Set(
      input.availableTranslationBackendFamilies.map((entry) => entry.trim()).filter(Boolean),
    );

    if (
      compatibility.readinessChecks.operationCapability
      && !availableOperationCapabilities.has(compatibility.requiredOperationCapability)
    ) {
      issues.push(Object.freeze({
        code: "required-operation-capability-missing",
        path: "compatibility.requiredOperationCapability",
        message: `Missing required operation capability '${compatibility.requiredOperationCapability}'.`,
      }));
    }

    if (compatibility.readinessChecks.inputKinds) {
      for (const requiredKind of compatibility.requiredInputKinds) {
        if (!availableInputKinds.has(requiredKind)) {
          issues.push(Object.freeze({
            code: "required-input-kind-missing",
            path: "compatibility.requiredInputKinds",
            message: `Missing required input kind '${requiredKind}'.`,
          }));
        }
      }
    }

    if (compatibility.readinessChecks.outputKinds) {
      for (const requiredKind of compatibility.requiredOutputKinds) {
        if (!availableOutputKinds.has(requiredKind)) {
          issues.push(Object.freeze({
            code: "required-output-kind-missing",
            path: "compatibility.requiredOutputKinds",
            message: `Missing required output kind '${requiredKind}'.`,
          }));
        }
      }
    }

    if (compatibility.readinessChecks.translationBackendFamily) {
      let hasKnownFamily = false;
      for (const family of compatibility.translationBackendFamilies) {
        if (availableTranslationBackendFamilies.has(family)) {
          hasKnownFamily = true;
          break;
        }
      }
      if (!hasKnownFamily) {
        issues.push(Object.freeze({
          code: "required-translation-backend-family-missing",
          path: "compatibility.translationBackendFamilies",
          message: `No compatible translation backend family found (${compatibility.translationBackendFamilies.join(", ")}).`,
        }));
      }
    }

    return Object.freeze({
      templateFamilyId: template.templateFamilyId,
      operationKind: template.operationKind,
      compatible: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }

  public resolveDefaultParameterValuesForOperationKind(
    operationKind: ImageWorkflowOperationKind,
  ): ResolvedImageWorkflowTemplateParameterValues | undefined {
    const template = this.templatesByOperation.get(operationKind);
    if (!template) {
      return undefined;
    }

    return Object.freeze({
      templateFamilyId: template.templateFamilyId,
      operationKind: template.operationKind,
      source: "defaults",
      parameterValues: template.configuration.defaults.parameterValues,
    });
  }

  public resolveParameterValuesForOperationKind(input: {
    readonly operationKind: ImageWorkflowOperationKind;
    readonly presetId?: string;
  }): ResolvedImageWorkflowTemplateParameterValues | undefined {
    const template = this.templatesByOperation.get(input.operationKind);
    if (!template) {
      return undefined;
    }

    const presetId = input.presetId?.trim();
    if (!presetId) {
      return this.resolveDefaultParameterValuesForOperationKind(input.operationKind);
    }

    const preset = template.configuration.presets.find((entry) => entry.presetId === presetId);
    if (!preset) {
      throw new Error(
        `Template '${template.templateFamilyId}' does not contain preset '${presetId}'.`,
      );
    }

    return Object.freeze({
      templateFamilyId: template.templateFamilyId,
      operationKind: template.operationKind,
      source: "preset",
      presetId: preset.presetId,
      parameterValues: Object.freeze({
        ...template.configuration.defaults.parameterValues,
        ...preset.parameterValues,
      }),
    });
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
  assertTemplateCompatibilityMetadataIsValid(template);

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

  assertTemplateConfigurationIsValid(template);
}

function assertTemplateCompatibilityMetadataIsValid(template: InitialImageWorkflowTemplateDefinition): void {
  assertRequiredString(template.compatibility.requiredOperationCapability, "compatibility.requiredOperationCapability");
  assertUniqueValues(template.compatibility.requiredInputKinds, "compatibility.requiredInputKinds");
  assertUniqueValues(template.compatibility.requiredOutputKinds, "compatibility.requiredOutputKinds");
  assertUniqueValues(template.compatibility.translationBackendFamilies, "compatibility.translationBackendFamilies");

  const requiredInputKinds = new Set(
    template.minimumRequirements.inputSlots.filter((slot) => slot.required).map((slot) => slot.kind),
  );
  for (const requiredInputKind of requiredInputKinds) {
    if (!template.compatibility.requiredInputKinds.includes(requiredInputKind)) {
      throw new Error(
        `Template '${template.templateFamilyId}' compatibility.requiredInputKinds must include '${requiredInputKind}'.`,
      );
    }
  }

  const requiredOutputKinds = new Set(
    template.minimumRequirements.outputExpectations.filter((output) => output.required).map((output) => output.kind),
  );
  for (const requiredOutputKind of requiredOutputKinds) {
    if (!template.compatibility.requiredOutputKinds.includes(requiredOutputKind)) {
      throw new Error(
        `Template '${template.templateFamilyId}' compatibility.requiredOutputKinds must include '${requiredOutputKind}'.`,
      );
    }
  }

  if (template.compatibility.readinessChecks.translationBackendFamily) {
    const hasMatchingTranslationFamily = template.compatibility.translationBackendFamilies.some(
      (family) => family.endsWith(template.translation.adapterFamily.replace("adapter.", "")),
    );
    if (!hasMatchingTranslationFamily) {
      throw new Error(
        `Template '${template.templateFamilyId}' compatibility.translationBackendFamilies must align with translation.adapterFamily.`,
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

function assertTemplateConfigurationIsValid(template: InitialImageWorkflowTemplateDefinition): void {
  assertRequiredString(template.configuration.defaults.title, "configuration.defaults.title");
  assertRequiredString(template.configuration.defaults.summary, "configuration.defaults.summary");

  const parametersById = new Map(template.minimumRequirements.parameterSpecifications.map((parameter) => [
    parameter.parameterId,
    parameter,
  ]));

  const requiredParameterIds = new Set(
    template.minimumRequirements.parameterSpecifications
      .filter((parameter) => parameter.required)
      .map((parameter) => parameter.parameterId),
  );

  const guidanceById = new Map(template.configuration.parameterGuidance.map((entry) => [entry.parameterId, entry]));
  for (const parameter of template.minimumRequirements.parameterSpecifications) {
    const guidance = guidanceById.get(parameter.parameterId);
    if (!guidance) {
      throw new Error(
        `Template '${template.templateFamilyId}' is missing guidance for parameter '${parameter.parameterId}'.`,
      );
    }
    assertRequiredString(guidance.label, `configuration.parameterGuidance '${parameter.parameterId}' label`);
    assertRequiredString(guidance.helperText, `configuration.parameterGuidance '${parameter.parameterId}' helperText`);
    assertRangeMetadataIsValid(template, parameter.parameterId, guidance.recommendedRange, "recommendedRange");
    assertRangeMetadataIsValid(template, parameter.parameterId, guidance.guardrails, "guardrails");
  }

  const defaults = template.configuration.defaults.parameterValues;
  assertParameterValueMapIsValid({
    template,
    values: defaults,
    valuesLabel: "configuration.defaults.parameterValues",
    parametersById,
    requiredParameterIds,
  });

  const seenPresetIds = new Set<string>();
  for (const preset of template.configuration.presets) {
    assertRequiredString(preset.presetId, "configuration.presets.presetId");
    if (seenPresetIds.has(preset.presetId)) {
      throw new Error(`Template '${template.templateFamilyId}' has duplicate preset id '${preset.presetId}'.`);
    }
    seenPresetIds.add(preset.presetId);
    if (!Object.values(InitialImageWorkflowTemplatePresetScopes).includes(preset.scope)) {
      throw new Error(`Template '${template.templateFamilyId}' preset '${preset.presetId}' scope is invalid.`);
    }
    assertRequiredString(preset.title, `configuration.presets '${preset.presetId}' title`);
    assertRequiredString(preset.summary, `configuration.presets '${preset.presetId}' summary`);

    assertParameterValueMapIsValid({
      template,
      values: preset.parameterValues,
      valuesLabel: `configuration.presets '${preset.presetId}' parameterValues`,
      parametersById,
      requiredParameterIds,
      allowMissingRequired: true,
    });

    const mergedValues = {
      ...defaults,
      ...preset.parameterValues,
    };

    for (const [parameterId, value] of Object.entries(mergedValues)) {
      const guidance = guidanceById.get(parameterId);
      const parameterRequirement = parametersById.get(parameterId);
      if (!guidance || !parameterRequirement) {
        continue;
      }
      assertValueCompliesWithGuardrails({
        template,
        parameterId,
        parameterRequirement,
        guardrails: guidance.guardrails,
        value,
        valuesLabel: `preset '${preset.presetId}'`,
      });
    }
  }
}

function assertParameterValueMapIsValid(input: {
  readonly template: InitialImageWorkflowTemplateDefinition;
  readonly values: Readonly<Record<string, unknown>>;
  readonly valuesLabel: string;
  readonly parametersById: ReadonlyMap<string, InitialImageWorkflowTemplateParameterRequirement>;
  readonly requiredParameterIds: ReadonlySet<string>;
  readonly allowMissingRequired?: boolean;
}): void {
  const providedIds = Object.keys(input.values);
  for (const parameterId of providedIds) {
    const parameterRequirement = input.parametersById.get(parameterId);
    if (!parameterRequirement) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} references unknown parameter '${parameterId}'.`,
      );
    }

    assertParameterValueType(parameterRequirement, input.values[parameterId], input.template.templateFamilyId, input.valuesLabel);
  }

  if (input.allowMissingRequired) {
    return;
  }

  for (const requiredParameterId of input.requiredParameterIds) {
    if (!providedIds.includes(requiredParameterId)) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} must include required parameter '${requiredParameterId}'.`,
      );
    }
  }
}

function assertRangeMetadataIsValid(
  template: InitialImageWorkflowTemplateDefinition,
  parameterId: string,
  range: InitialImageWorkflowTemplateParameterValueRecommendedRange | InitialImageWorkflowTemplateParameterValueGuardrails | undefined,
  field: string,
): void {
  if (!range) {
    return;
  }

  if (typeof range.minimum === "number" && typeof range.maximum === "number" && range.minimum > range.maximum) {
    throw new Error(
      `Template '${template.templateFamilyId}' ${field} minimum cannot exceed maximum for parameter '${parameterId}'.`,
    );
  }
  if ("step" in range && typeof range.step === "number" && range.step <= 0) {
    throw new Error(
      `Template '${template.templateFamilyId}' ${field} step must be greater than zero for parameter '${parameterId}'.`,
    );
  }
  if (typeof range.minLength === "number" && range.minLength < 0) {
    throw new Error(
      `Template '${template.templateFamilyId}' ${field} minLength must be non-negative for parameter '${parameterId}'.`,
    );
  }
  if (typeof range.maxLength === "number" && range.maxLength < 0) {
    throw new Error(
      `Template '${template.templateFamilyId}' ${field} maxLength must be non-negative for parameter '${parameterId}'.`,
    );
  }
  if (
    typeof range.minLength === "number"
    && typeof range.maxLength === "number"
    && range.minLength > range.maxLength
  ) {
    throw new Error(
      `Template '${template.templateFamilyId}' ${field} minLength cannot exceed maxLength for parameter '${parameterId}'.`,
    );
  }
}

function assertParameterValueType(
  parameter: InitialImageWorkflowTemplateParameterRequirement,
  value: unknown,
  templateFamilyId: string,
  valuesLabel: string,
): void {
  const valueKind = parameter.valueKind;

  if (valueKind === "text") {
    if (typeof value !== "string") {
      throw new Error(`Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be text.`);
    }
    return;
  }

  if (valueKind === "integer") {
    if (!Number.isInteger(value)) {
      throw new Error(`Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be an integer.`);
    }
    return;
  }

  if (valueKind === "float") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be a number.`);
    }
    return;
  }

  if (valueKind === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error(`Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be boolean.`);
    }
    return;
  }

  if (valueKind === "select") {
    if (typeof value !== "string") {
      throw new Error(`Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be a select value.`);
    }
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Template '${templateFamilyId}' ${valuesLabel} parameter '${parameter.parameterId}' must be a non-empty logical reference string.`,
    );
  }
}

function assertValueCompliesWithGuardrails(input: {
  readonly template: InitialImageWorkflowTemplateDefinition;
  readonly parameterId: string;
  readonly parameterRequirement: InitialImageWorkflowTemplateParameterRequirement;
  readonly guardrails: InitialImageWorkflowTemplateParameterValueGuardrails | undefined;
  readonly value: unknown;
  readonly valuesLabel: string;
}): void {
  if (!input.guardrails) {
    return;
  }

  const { guardrails, parameterRequirement, value } = input;
  if (parameterRequirement.valueKind === "text" && typeof value === "string") {
    if (guardrails.allowEmpty === false && value.trim().length === 0) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' cannot be empty.`,
      );
    }
    if (typeof guardrails.minLength === "number" && value.length < guardrails.minLength) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' is below minLength guardrail.`,
      );
    }
    if (typeof guardrails.maxLength === "number" && value.length > guardrails.maxLength) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' exceeds maxLength guardrail.`,
      );
    }
  }

  if ((parameterRequirement.valueKind === "integer" || parameterRequirement.valueKind === "float") && typeof value === "number") {
    if (typeof guardrails.minimum === "number" && value < guardrails.minimum) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' is below minimum guardrail.`,
      );
    }
    if (typeof guardrails.maximum === "number" && value > guardrails.maximum) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' exceeds maximum guardrail.`,
      );
    }
  }

  if (guardrails.allowedValues && guardrails.allowedValues.length > 0) {
    if (!guardrails.allowedValues.includes(value as string | number | boolean)) {
      throw new Error(
        `Template '${input.template.templateFamilyId}' ${input.valuesLabel} parameter '${input.parameterId}' violates allowedValues guardrail.`,
      );
    }
  }
}

