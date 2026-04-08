import {
  ImageManipulationTranslationDiagnosticCategories,
  ImageManipulationTranslationDiagnosticSeverities,
  ImageManipulationTranslationStatuses,
  validateImageManipulationTranslationRequest,
  validateImageManipulationTranslationResult,
  type IImageManipulationTemplateTranslationPort,
  type ImageManipulationBackendExecutionPayload,
  type ImageManipulationTranslationDiagnostic,
  type ImageManipulationTranslationRequest,
  type ImageManipulationTranslationResult,
} from "@application/image-workflows/ports";
import { InitialImageWorkflowTemplateFamilyIds } from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";

type TranslationTemplateResolver = (input: {
  readonly request: ImageManipulationTranslationRequest;
  readonly resolved: ResolvedTemplateMappings;
}) => Readonly<Record<string, unknown>>;

interface ResolvedTemplateMappings {
  readonly sourceImageRef?: string;
  readonly maskImageRef?: string;
  readonly prompt?: string;
  readonly variationStrength?: number;
  readonly scaleFactor?: number;
  readonly preserveUnmaskedAreas?: boolean;
}

interface SupportedTemplateRegistration {
  readonly operationKind: string;
  readonly requiredInputs: ReadonlyArray<string>;
  readonly requiredParameters: ReadonlyArray<string>;
  readonly requiredOutputs: ReadonlyArray<string>;
  readonly toComfyPrompt: TranslationTemplateResolver;
}

const fallbackBackendFamily = "backend-family.comfyui.image-manipulation";
const fallbackContractVersion = "1.0.0";

const templateRegistrations: Readonly<Record<string, SupportedTemplateRegistration>> = Object.freeze({
  [InitialImageWorkflowTemplateFamilyIds.imageToImageRestyle]: Object.freeze({
    operationKind: "image-to-image",
    requiredInputs: Object.freeze(["inputs.source-image"]),
    requiredParameters: Object.freeze(["parameters.prompt", "parameters.variation-strength"]),
    requiredOutputs: Object.freeze(["outputs.generated-image"]),
    toComfyPrompt: ({ resolved }) => Object.freeze({
      "1": Object.freeze({
        class_type: "LoadImage",
        inputs: Object.freeze({
          image: resolved.sourceImageRef,
        }),
      }),
      "2": Object.freeze({
        class_type: "CheckpointLoaderSimple",
        inputs: Object.freeze({
          ckpt_name: "runtime:default-checkpoint",
        }),
      }),
      "3": Object.freeze({
        class_type: "CLIPTextEncode",
        inputs: Object.freeze({
          text: resolved.prompt,
          clip: Object.freeze(["2", 1]),
        }),
      }),
      "4": Object.freeze({
        class_type: "CLIPTextEncode",
        inputs: Object.freeze({
          text: "",
          clip: Object.freeze(["2", 1]),
        }),
      }),
      "5": Object.freeze({
        class_type: "VAEEncode",
        inputs: Object.freeze({
          pixels: Object.freeze(["1", 0]),
          vae: Object.freeze(["2", 2]),
        }),
      }),
      "6": Object.freeze({
        class_type: "KSampler",
        inputs: Object.freeze({
          model: Object.freeze(["2", 0]),
          positive: Object.freeze(["3", 0]),
          negative: Object.freeze(["4", 0]),
          latent_image: Object.freeze(["5", 0]),
          seed: 0,
          steps: 30,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: resolved.variationStrength,
        }),
      }),
      "7": Object.freeze({
        class_type: "VAEDecode",
        inputs: Object.freeze({
          samples: Object.freeze(["6", 0]),
          vae: Object.freeze(["2", 2]),
        }),
      }),
      "8": Object.freeze({
        class_type: "SaveImage",
        inputs: Object.freeze({
          images: Object.freeze(["7", 0]),
          filename_prefix: "ai-loom-restyle",
        }),
      }),
    }),
  }),
  [InitialImageWorkflowTemplateFamilyIds.enhanceUpscale]: Object.freeze({
    operationKind: "enhance-upscale",
    requiredInputs: Object.freeze(["inputs.source-image"]),
    requiredParameters: Object.freeze(["parameters.scale-factor"]),
    requiredOutputs: Object.freeze(["outputs.enhanced-image"]),
    toComfyPrompt: ({ resolved }) => Object.freeze({
      "1": Object.freeze({
        class_type: "LoadImage",
        inputs: Object.freeze({
          image: resolved.sourceImageRef,
        }),
      }),
      "2": Object.freeze({
        class_type: "ImageScaleBy",
        inputs: Object.freeze({
          image: Object.freeze(["1", 0]),
          upscale_method: "lanczos",
          scale_by: resolved.scaleFactor,
        }),
      }),
      "3": Object.freeze({
        class_type: "SaveImage",
        inputs: Object.freeze({
          images: Object.freeze(["2", 0]),
          filename_prefix: "ai-loom-enhance",
        }),
      }),
    }),
  }),
  [InitialImageWorkflowTemplateFamilyIds.maskGuidedEdit]: Object.freeze({
    operationKind: "mask-guided-edit",
    requiredInputs: Object.freeze(["inputs.source-image", "inputs.mask-image"]),
    requiredParameters: Object.freeze(["parameters.prompt"]),
    requiredOutputs: Object.freeze(["outputs.edited-image"]),
    toComfyPrompt: ({ resolved }) => Object.freeze({
      "1": Object.freeze({
        class_type: "LoadImage",
        inputs: Object.freeze({
          image: resolved.sourceImageRef,
        }),
      }),
      "2": Object.freeze({
        class_type: "LoadImage",
        inputs: Object.freeze({
          image: resolved.maskImageRef,
        }),
      }),
      "3": Object.freeze({
        class_type: "CheckpointLoaderSimple",
        inputs: Object.freeze({
          ckpt_name: "runtime:default-checkpoint",
        }),
      }),
      "4": Object.freeze({
        class_type: "CLIPTextEncode",
        inputs: Object.freeze({
          text: resolved.prompt,
          clip: Object.freeze(["3", 1]),
        }),
      }),
      "5": Object.freeze({
        class_type: "CLIPTextEncode",
        inputs: Object.freeze({
          text: "",
          clip: Object.freeze(["3", 1]),
        }),
      }),
      "6": Object.freeze({
        class_type: "VAEEncode",
        inputs: Object.freeze({
          pixels: Object.freeze(["1", 0]),
          vae: Object.freeze(["3", 2]),
        }),
      }),
      "7": Object.freeze({
        class_type: "SetLatentNoiseMask",
        inputs: Object.freeze({
          samples: Object.freeze(["6", 0]),
          mask: Object.freeze(["2", 0]),
        }),
      }),
      "8": Object.freeze({
        class_type: "KSampler",
        inputs: Object.freeze({
          model: Object.freeze(["3", 0]),
          positive: Object.freeze(["4", 0]),
          negative: Object.freeze(["5", 0]),
          latent_image: Object.freeze(["7", 0]),
          seed: 0,
          steps: 28,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: resolved.preserveUnmaskedAreas === false ? 0.75 : 0.35,
        }),
      }),
      "9": Object.freeze({
        class_type: "VAEDecode",
        inputs: Object.freeze({
          samples: Object.freeze(["8", 0]),
          vae: Object.freeze(["3", 2]),
        }),
      }),
      "10": Object.freeze({
        class_type: "SaveImage",
        inputs: Object.freeze({
          images: Object.freeze(["9", 0]),
          filename_prefix: "ai-loom-mask-edit",
        }),
      }),
    }),
  }),
});

export interface ComfyImageManipulationTemplateTranslationAdapterOptions {
  readonly now?: () => Date;
  readonly backendFamily?: string;
}

export class ComfyImageManipulationTemplateTranslationAdapter implements IImageManipulationTemplateTranslationPort {
  private readonly now: () => Date;
  private readonly backendFamily: string;

  public constructor(options: ComfyImageManipulationTemplateTranslationAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.backendFamily = options.backendFamily?.trim() || fallbackBackendFamily;
  }

  public async translateToBackendPayload(
    input: ImageManipulationTranslationRequest,
  ): Promise<ImageManipulationTranslationResult> {
    const translatedAt = this.now().toISOString();
    const diagnostics: ImageManipulationTranslationDiagnostic[] = [];
    let request: ImageManipulationTranslationRequest;

    try {
      request = validateImageManipulationTranslationRequest(input);
    } catch (error) {
      return this.createFailureResult({
        request: undefined,
        translatedAt,
        diagnostics: Object.freeze([this.createDiagnostic({
          code: "invalid-translation-request",
          category: ImageManipulationTranslationDiagnosticCategories.requestValidation,
          path: "request",
          message: error instanceof Error ? error.message : "Translation request validation failed.",
          blocking: true,
          details: Object.freeze({
            source: "validateImageManipulationTranslationRequest",
          }),
        })]),
      });
    }

    const registration = templateRegistrations[request.templateResolution.templateId];
    if (!registration) {
      diagnostics.push(this.createDiagnostic({
        code: "unsupported-template-id",
        category: ImageManipulationTranslationDiagnosticCategories.templateResolution,
        path: "templateResolution.templateId",
        message: `ComfyUI translation adapter does not support template '${request.templateResolution.templateId}'.`,
        blocking: true,
      }));
      return this.createFailureResult({ request, translatedAt, diagnostics: Object.freeze(diagnostics) });
    }

    if (registration.operationKind !== request.authoritative.workflow.operationKind) {
      diagnostics.push(this.createDiagnostic({
        code: "operation-template-mismatch",
        category: ImageManipulationTranslationDiagnosticCategories.templateResolution,
        path: "authoritative.workflow.operationKind",
        message: `Template '${request.templateResolution.templateId}' does not support operation '${request.authoritative.workflow.operationKind}'.`,
        blocking: true,
        details: Object.freeze({
          expectedOperationKind: registration.operationKind,
          actualOperationKind: request.authoritative.workflow.operationKind,
        }),
      }));
    }

    const resolved = this.resolveTemplateMappings({
      request,
      registration,
      diagnostics,
    });

    if (hasBlockingDiagnostics(diagnostics)) {
      return this.createFailureResult({ request, translatedAt, diagnostics: Object.freeze(diagnostics) });
    }

    const backendFamily = this.resolveBackendFamily(request);
    const comfyPrompt = registration.toComfyPrompt({ request, resolved });
    const comfyRequestPayload = Object.freeze({
      client_id: request.runId,
      prompt: comfyPrompt,
    });

    const payload: ImageManipulationBackendExecutionPayload = Object.freeze({
      payloadVersion: request.contractVersion,
      backendFamily,
      operationKind: request.authoritative.workflow.operationKind,
      template: Object.freeze({
        translatorId: request.templateResolution.translatorId,
        contractVersion: request.templateResolution.contractVersion,
        templateId: request.templateResolution.templateId,
        templateVersion: request.templateResolution.templateVersion,
      }),
      requestContext: Object.freeze({
        translationRequestId: request.translationRequestId,
        runId: request.runId,
        workspaceId: request.workspaceId,
        workflowId: request.authoritative.workflow.workflowId,
        systemId: request.authoritative.system.systemId,
        correlationId: request.correlationId,
      }),
      inputs: Object.freeze({
        ...toKeyValueRecord(request.slotBindings, (entry) => entry.backendField, (entry) => entry.logicalReference),
        "comfy.request": comfyRequestPayload,
      }),
      parameters: Object.freeze(toKeyValueRecord(
        request.parameterMappings,
        (entry) => entry.backendField,
        (entry) => entry.value,
      )),
      outputs: Object.freeze(request.outputExpectations.map((entry) => Object.freeze({
        outputId: entry.outputId,
        backendField: entry.backendField,
        required: entry.required,
        allowsMultiple: entry.allowsMultiple,
        logicalTargetReference: entry.logicalTargetReference,
      }))),
      requiredCapabilities: Object.freeze([...request.capabilityRequirements.requiredCapabilities]),
      metadata: Object.freeze({
        adapterFamily: request.templateResolution.adapterFamily,
        operationTypeKey: request.templateResolution.operationTypeKey,
        comfyRequestPayload,
      }),
    });

    const result = validateImageManipulationTranslationResult({
      status: ImageManipulationTranslationStatuses.succeeded,
      executionPayload: payload,
      diagnostics: Object.freeze(diagnostics),
      metadata: Object.freeze({
        translatedAt,
        translatorId: request.templateResolution.translatorId,
        contractVersion: request.templateResolution.contractVersion,
        templateId: request.templateResolution.templateId,
        templateVersion: request.templateResolution.templateVersion,
        backendFamily,
        mappingSummary: Object.freeze({
          slotBindingCount: request.slotBindings.length,
          parameterMappingCount: request.parameterMappings.length,
          outputExpectationCount: request.outputExpectations.length,
        }),
        diagnosticsSummary: summarizeDiagnostics(diagnostics),
      }),
    });

    return result;
  }

  private resolveTemplateMappings(input: {
    readonly request: ImageManipulationTranslationRequest;
    readonly registration: SupportedTemplateRegistration;
    readonly diagnostics: Array<ImageManipulationTranslationDiagnostic>;
  }): ResolvedTemplateMappings {
    const slotByField = toKeyValueRecord(input.request.slotBindings, (entry) => entry.backendField, (entry) => entry);
    const parameterByField = toKeyValueRecord(
      input.request.parameterMappings,
      (entry) => entry.backendField,
      (entry) => entry,
    );
    const outputByField = toKeyValueRecord(
      input.request.outputExpectations,
      (entry) => entry.backendField,
      (entry) => entry,
    );

    for (const backendField of input.registration.requiredInputs) {
      if (!slotByField[backendField]) {
        input.diagnostics.push(this.createDiagnostic({
          code: "missing-required-slot-binding",
          category: ImageManipulationTranslationDiagnosticCategories.slotBinding,
          path: `slotBindings.${backendField}`,
          message: `Required slot binding '${backendField}' was not provided for template translation.`,
          blocking: true,
        }));
      }
    }
    for (const backendField of input.registration.requiredParameters) {
      if (!parameterByField[backendField]) {
        input.diagnostics.push(this.createDiagnostic({
          code: "missing-required-parameter-mapping",
          category: ImageManipulationTranslationDiagnosticCategories.parameterMapping,
          path: `parameterMappings.${backendField}`,
          message: `Required parameter mapping '${backendField}' was not provided for template translation.`,
          blocking: true,
        }));
      }
    }
    for (const backendField of input.registration.requiredOutputs) {
      if (!outputByField[backendField]) {
        input.diagnostics.push(this.createDiagnostic({
          code: "missing-required-output-expectation",
          category: ImageManipulationTranslationDiagnosticCategories.outputMapping,
          path: `outputExpectations.${backendField}`,
          message: `Required output expectation '${backendField}' was not provided for template translation.`,
          blocking: true,
        }));
      }
    }

    const variationStrength = toOptionalNumber(parameterByField["parameters.variation-strength"]?.value);
    if (variationStrength !== undefined && (variationStrength < 0 || variationStrength > 1)) {
      input.diagnostics.push(this.createDiagnostic({
        code: "invalid-variation-strength",
        category: ImageManipulationTranslationDiagnosticCategories.parameterMapping,
        path: "parameterMappings.parameters.variation-strength",
        message: "Variation strength must be between 0 and 1 for ComfyUI image-to-image translation.",
        blocking: true,
      }));
    }

    const scaleFactor = toOptionalNumber(parameterByField["parameters.scale-factor"]?.value);
    if (scaleFactor !== undefined && scaleFactor <= 0) {
      input.diagnostics.push(this.createDiagnostic({
        code: "invalid-scale-factor",
        category: ImageManipulationTranslationDiagnosticCategories.parameterMapping,
        path: "parameterMappings.parameters.scale-factor",
        message: "Scale factor must be greater than zero for ComfyUI enhance/upscale translation.",
        blocking: true,
      }));
    }

    return Object.freeze({
      sourceImageRef: slotByField["inputs.source-image"]?.logicalReference,
      maskImageRef: slotByField["inputs.mask-image"]?.logicalReference,
      prompt: typeof parameterByField["parameters.prompt"]?.value === "string"
        ? parameterByField["parameters.prompt"].value
        : undefined,
      variationStrength,
      scaleFactor,
      preserveUnmaskedAreas: toOptionalBoolean(parameterByField["parameters.preserve-unmasked-areas"]?.value),
    });
  }

  private resolveBackendFamily(request: ImageManipulationTranslationRequest): string {
    return request.capabilityRequirements.preferredBackendFamily?.trim()
      || request.templateResolution.adapterFamily?.trim()
      || this.backendFamily;
  }

  private createFailureResult(input: {
    readonly request: ImageManipulationTranslationRequest | undefined;
    readonly translatedAt: string;
    readonly diagnostics: ReadonlyArray<ImageManipulationTranslationDiagnostic>;
  }): ImageManipulationTranslationResult {
    const request = input.request;
    return validateImageManipulationTranslationResult({
      status: ImageManipulationTranslationStatuses.failed,
      diagnostics: input.diagnostics,
      metadata: Object.freeze({
        translatedAt: input.translatedAt,
        translatorId: request?.templateResolution.translatorId ?? "adapter.comfyui.image-manipulation",
        contractVersion: request?.templateResolution.contractVersion ?? fallbackContractVersion,
        templateId: request?.templateResolution.templateId ?? "unknown-template",
        templateVersion: request?.templateResolution.templateVersion,
        backendFamily: this.backendFamily,
        mappingSummary: Object.freeze({
          slotBindingCount: request?.slotBindings.length ?? 0,
          parameterMappingCount: request?.parameterMappings.length ?? 0,
          outputExpectationCount: request?.outputExpectations.length ?? 0,
        }),
        diagnosticsSummary: summarizeDiagnostics(input.diagnostics),
      }),
    });
  }

  private createDiagnostic(input: {
    readonly code: string;
    readonly category: ImageManipulationTranslationDiagnostic["category"];
    readonly path: string;
    readonly message: string;
    readonly blocking: boolean;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ImageManipulationTranslationDiagnostic {
    return Object.freeze({
      code: input.code,
      severity: input.blocking
        ? ImageManipulationTranslationDiagnosticSeverities.error
        : ImageManipulationTranslationDiagnosticSeverities.warning,
      category: input.category,
      path: input.path,
      message: input.message,
      blocking: input.blocking,
      details: input.details,
    });
  }
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function toKeyValueRecord<TEntry, TValue>(
  entries: ReadonlyArray<TEntry>,
  keySelector: (entry: TEntry) => string,
  valueSelector: (entry: TEntry) => TValue,
): Record<string, TValue> {
  const record: Record<string, TValue> = {};
  for (const entry of entries) {
    record[keySelector(entry)] = valueSelector(entry);
  }
  return record;
}

function hasBlockingDiagnostics(diagnostics: ReadonlyArray<ImageManipulationTranslationDiagnostic>): boolean {
  return diagnostics.some((entry) => entry.blocking || entry.severity === ImageManipulationTranslationDiagnosticSeverities.error);
}

function summarizeDiagnostics(diagnostics: ReadonlyArray<ImageManipulationTranslationDiagnostic>) {
  let infoCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let blockingCount = 0;

  for (const entry of diagnostics) {
    if (entry.severity === ImageManipulationTranslationDiagnosticSeverities.info) {
      infoCount += 1;
    } else if (entry.severity === ImageManipulationTranslationDiagnosticSeverities.warning) {
      warningCount += 1;
    } else {
      errorCount += 1;
    }
    if (entry.blocking) {
      blockingCount += 1;
    }
  }

  return Object.freeze({
    count: diagnostics.length,
    infoCount,
    warningCount,
    errorCount,
    blockingCount,
  });
}
