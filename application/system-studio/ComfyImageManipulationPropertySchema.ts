import { z } from "zod";

export const ComfyImageManipulationPropertySchemaId = "property-schema:image-manipulation";
export const ComfyImageManipulationPropertySchemaVersion = "1.3.0";

export const ComfyConditioningMapping = Object.freeze({
  positivePrompt: "desired-features",
  negativePrompt: "features-to-avoid",
} as const);

const promptDefaults = Object.freeze({
  positivePrompt: "A photorealistic portrait with natural lighting and sharp detail",
  negativePrompt: "blurry, distorted face, low quality, extra fingers",
});

const generationDefaults = Object.freeze({
  width: 1024,
  height: 1024,
  denoiseStrength: 0.6,
  variationStrength: 0.6,
  steps: 30,
  cfg: 7,
  sampler: "euler",
  scheduler: "normal",
  seed: 1337,
});

const outputDefaults = Object.freeze({
  resultCount: 1,
  outputTarget: "history",
});

const modelDefaults = Object.freeze({
  checkpointModel: "system-default",
  vaeModel: "system-default",
  faceIdModel: "system-default",
});

const faceIdDefaults = Object.freeze({
  enabled: false,
  referenceBindings: Object.freeze([
    Object.freeze({
      datasetBindingId: "faceid-reference",
      datasetAssetId: "asset:dataset:image-faceid-reference",
    }),
  ]),
  weight: 0.8,
  startStepFraction: 0,
  endStepFraction: 1,
});

const comfySamplerOptions = Object.freeze(["euler", "dpmpp_2m", "euler_a", "lms"] as const);
const comfySchedulerOptions = Object.freeze(["normal", "karras", "exponential", "sgm_uniform"] as const);

type ComfySamplerOption = (typeof comfySamplerOptions)[number];
type ComfySchedulerOption = (typeof comfySchedulerOptions)[number];

export interface ComfyImageManipulationConfig {
  readonly prompts: {
    readonly positivePrompt: string;
    readonly negativePrompt: string;
  };
  readonly models: {
    readonly checkpointModel: string;
    readonly vaeModel: string;
    readonly faceIdModel: string;
  };
  readonly generation: {
    readonly width: number;
    readonly height: number;
    readonly denoiseStrength: number;
    readonly variationStrength: number;
    readonly steps: number;
    readonly cfg: number;
    readonly sampler: ComfySamplerOption;
    readonly scheduler: ComfySchedulerOption;
    readonly seed: number;
  };
  readonly faceId: {
    readonly enabled: boolean;
    readonly referenceBindings: ReadonlyArray<{
      readonly datasetBindingId: string;
      readonly datasetAssetId: string;
    }>;
    readonly weight: number;
    readonly startStepFraction: number;
    readonly endStepFraction: number;
  };
  readonly output: {
    readonly resultCount: number;
    readonly outputTarget: "history" | "download";
  };
}

export interface ComfyImageManipulationConfigValidationIssue {
  readonly scope: "field" | "cross-field";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ComfyImageManipulationPropertySchemaDefinition {
  readonly id: typeof ComfyImageManipulationPropertySchemaId;
  readonly version: typeof ComfyImageManipulationPropertySchemaVersion;
  readonly capabilities: {
    readonly composable: true;
    readonly inspectable: true;
    readonly previewable: true;
    readonly serializable: true;
    readonly versioned: true;
  };
  readonly fields: ReadonlyArray<{
    readonly groupId: "prompts" | "models" | "generation" | "faceId" | "output";
    readonly groupLabel: string;
    readonly entries: ReadonlyArray<{
      readonly id: string;
      readonly path: string;
      readonly type: "string" | "number" | "integer" | "enum" | "boolean" | "dataset-reference-list";
      readonly required: boolean;
      readonly defaultValue: unknown;
      readonly label: string;
      readonly description: string;
      readonly validation: Readonly<Record<string, unknown>>;
      readonly mapping?: "desired-features" | "features-to-avoid";
      readonly metadata?: Readonly<Record<string, unknown>>;
    }>;
  }>;
  readonly defaultConfig: ComfyImageManipulationConfig;
}

const ComfyImageManipulationConfigSchema = z.object({
  prompts: z.object({
    positivePrompt: z.string().trim().min(1, "Describe what you want to create is required.").default(promptDefaults.positivePrompt),
    negativePrompt: z.string().trim().default(promptDefaults.negativePrompt),
  }).default(promptDefaults),
  models: z.object({
    checkpointModel: z.string().trim().min(1).default(modelDefaults.checkpointModel),
    vaeModel: z.string().trim().min(1).default(modelDefaults.vaeModel),
    faceIdModel: z.string().trim().min(1).default(modelDefaults.faceIdModel),
  }).default(modelDefaults),
  generation: z.object({
    width: z.number().int().min(256).max(2048).multipleOf(64).default(generationDefaults.width),
    height: z.number().int().min(256).max(2048).multipleOf(64).default(generationDefaults.height),
    denoiseStrength: z.number().min(0).max(1).default(generationDefaults.denoiseStrength),
    variationStrength: z.number().min(0).max(1).default(generationDefaults.variationStrength),
    steps: z.number().int().min(1).max(200).default(generationDefaults.steps),
    cfg: z.number().min(1).max(30).default(generationDefaults.cfg),
    sampler: z.enum(comfySamplerOptions).default(generationDefaults.sampler),
    scheduler: z.enum(comfySchedulerOptions).default(generationDefaults.scheduler),
    seed: z.number().int().min(0).max(2147483647).default(generationDefaults.seed),
  }).default(generationDefaults),
  faceId: z.object({
    enabled: z.boolean().default(faceIdDefaults.enabled),
    referenceBindings: z.array(
      z.object({
        datasetBindingId: z.string().trim().regex(/^[a-z0-9-]+$/),
        datasetAssetId: z.string().trim().startsWith("asset:dataset:"),
      }),
    ).max(8).default(faceIdDefaults.referenceBindings),
    weight: z.number().min(0).max(2).default(faceIdDefaults.weight),
    startStepFraction: z.number().min(0).max(1).default(faceIdDefaults.startStepFraction),
    endStepFraction: z.number().min(0).max(1).default(faceIdDefaults.endStepFraction),
  }).superRefine((value, ctx) => {
    if (value.enabled && value.referenceBindings.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceBindings"],
        message: "Add at least one identity reference image when identity guidance is turned on.",
      });
    }

    if (value.startStepFraction > value.endStepFraction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endStepFraction"],
        message: "Face guidance end step must be greater than or equal to the start step.",
      });
    }
  }).default(faceIdDefaults),
  output: z.object({
    resultCount: z.number().int().min(1).max(4).default(outputDefaults.resultCount),
    outputTarget: z.enum(["history", "download"]).default(outputDefaults.outputTarget),
  }).default(outputDefaults),
}).superRefine((value, ctx) => {
  if (value.prompts.positivePrompt.trim().length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prompts", "positivePrompt"],
      message: "Describe what you want to create is required.",
    });
  }

  if (value.output.resultCount > 1 && value.output.outputTarget === "download") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["output", "outputTarget"],
      message: "Download supports one image at a time. Save to History for multiple results.",
    });
  }
});

function normalizeInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export const ComfyImageManipulationPropertySchema: ComfyImageManipulationPropertySchemaDefinition = Object.freeze({
  id: ComfyImageManipulationPropertySchemaId,
  version: ComfyImageManipulationPropertySchemaVersion,
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    serializable: true,
    versioned: true,
  }),
  fields: Object.freeze([
    Object.freeze({
      groupId: "prompts",
      groupLabel: "Prompts",
      entries: Object.freeze([
        Object.freeze({
          id: "positivePrompt",
          path: "prompts.positivePrompt",
          type: "string",
          required: true,
          defaultValue: promptDefaults.positivePrompt,
          label: "Describe what you want to create",
          description: "Tell the system what you want to see in the generated image.",
          validation: Object.freeze({ nonEmpty: true }),
          mapping: ComfyConditioningMapping.positivePrompt,
        }),
        Object.freeze({
          id: "negativePrompt",
          path: "prompts.negativePrompt",
          type: "string",
          required: false,
          defaultValue: promptDefaults.negativePrompt,
          label: "What to avoid",
          description: "List details you do not want in the generated image.",
          validation: Object.freeze({ nonEmptyWhenProvided: true }),
          mapping: ComfyConditioningMapping.negativePrompt,
        }),
      ]),
    }),
    Object.freeze({
      groupId: "models",
      groupLabel: "Models",
      entries: Object.freeze([
        Object.freeze({
          id: "checkpointModel",
          path: "models.checkpointModel",
          type: "string",
          required: true,
          defaultValue: modelDefaults.checkpointModel,
          label: "Base model",
          description: "Choose the main model used for image generation.",
          validation: Object.freeze({ nonEmpty: true }),
          metadata: Object.freeze({
            role: "checkpoint",
            runtimeBinding: "comfy.checkpoint",
            optionSource: "runtime-installed-models",
            fallbackResolution: "system-default",
          }),
        }),
        Object.freeze({
          id: "vaeModel",
          path: "models.vaeModel",
          type: "string",
          required: true,
          defaultValue: modelDefaults.vaeModel,
          label: "Detail model",
          description: "Choose how image details are encoded and decoded.",
          validation: Object.freeze({ nonEmpty: true }),
          metadata: Object.freeze({
            role: "vae",
            runtimeBinding: "comfy.vae",
            optionSource: "runtime-installed-models",
            fallbackResolution: "system-default",
          }),
        }),
        Object.freeze({
          id: "faceIdModel",
          path: "models.faceIdModel",
          type: "string",
          required: true,
          defaultValue: modelDefaults.faceIdModel,
          label: "Identity model",
          description: "Choose the model used when identity guidance is enabled.",
          validation: Object.freeze({ nonEmpty: true }),
          metadata: Object.freeze({
            role: "faceid",
            runtimeBinding: "comfy.faceid",
            optionSource: "runtime-installed-models",
            fallbackResolution: "system-default",
          }),
        }),
      ]),
    }),
    Object.freeze({
      groupId: "generation",
      groupLabel: "Generation",
      entries: Object.freeze([
        Object.freeze({
          id: "width",
          path: "generation.width",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.width,
          label: "Image width",
          description: "Set the output image width in pixels.",
          validation: Object.freeze({ min: 256, max: 2048, multipleOf: 64 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.width",
            sizingMode: "discrete-pixel-grid",
          }),
        }),
        Object.freeze({
          id: "height",
          path: "generation.height",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.height,
          label: "Image height",
          description: "Set the output image height in pixels.",
          validation: Object.freeze({ min: 256, max: 2048, multipleOf: 64 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.height",
            sizingMode: "discrete-pixel-grid",
          }),
        }),
        Object.freeze({
          id: "denoiseStrength",
          path: "generation.denoiseStrength",
          type: "number",
          required: true,
          defaultValue: generationDefaults.denoiseStrength,
          label: "Edit strength",
          description: "Higher values change more of the original image.",
          validation: Object.freeze({ min: 0, max: 1 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.denoise",
            executionUse: "image-to-image-strength",
          }),
        }),
        Object.freeze({
          id: "variationStrength",
          path: "generation.variationStrength",
          type: "number",
          required: true,
          defaultValue: generationDefaults.variationStrength,
          label: "Creativity level",
          description: "Higher values allow bigger visual changes from the source image.",
          validation: Object.freeze({ min: 0, max: 1 }),
        }),
        Object.freeze({
          id: "steps",
          path: "generation.steps",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.steps,
          label: "Quality steps",
          description: "Higher values can improve quality but take longer.",
          validation: Object.freeze({ min: 1, max: 200 }),
        }),
        Object.freeze({
          id: "cfg",
          path: "generation.cfg",
          type: "number",
          required: true,
          defaultValue: generationDefaults.cfg,
          label: "Instruction strength",
          description: "Higher values follow your instructions more closely.",
          validation: Object.freeze({ min: 1, max: 30 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.cfg",
            technicalLabel: "CFG",
            progressiveDisclosure: "advanced",
          }),
        }),
        Object.freeze({
          id: "sampler",
          path: "generation.sampler",
          type: "enum",
          required: true,
          defaultValue: generationDefaults.sampler,
          label: "Render method",
          description: "Choose how the system builds each image.",
          validation: Object.freeze({ options: [...comfySamplerOptions] }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.sampler_name",
            progressiveDisclosure: "advanced",
          }),
        }),
        Object.freeze({
          id: "scheduler",
          path: "generation.scheduler",
          type: "enum",
          required: true,
          defaultValue: generationDefaults.scheduler,
          label: "Step timing",
          description: "Choose how rendering effort is distributed across steps.",
          validation: Object.freeze({ options: [...comfySchedulerOptions] }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.scheduler",
            progressiveDisclosure: "advanced",
          }),
        }),
        Object.freeze({
          id: "seed",
          path: "generation.seed",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.seed,
          label: "Variation code",
          description: "Reuse this number for similar results, or change it for new variations.",
          validation: Object.freeze({ min: 0, max: 2147483647 }),
          metadata: Object.freeze({
            deterministicByDefault: true,
            randomizationMode: "future-compatible",
            technicalLabel: "Seed",
            progressiveDisclosure: "advanced",
          }),
        }),
      ]),
    }),
    Object.freeze({
      groupId: "faceId",
      groupLabel: "Identity guidance",
      entries: Object.freeze([
        Object.freeze({
          id: "enabled",
          path: "faceId.enabled",
          type: "boolean",
          required: true,
          defaultValue: faceIdDefaults.enabled,
          label: "Keep face identity",
          description: "Turn on identity guidance to keep a person’s face consistent.",
          validation: Object.freeze({ required: true }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.faceid.enabled",
            progressiveDisclosure: "advanced-optional",
          }),
        }),
        Object.freeze({
          id: "referenceBindings",
          path: "faceId.referenceBindings",
          type: "dataset-reference-list",
          required: true,
          defaultValue: faceIdDefaults.referenceBindings,
          label: "Identity reference images",
          description: "Choose one or more reference images from the FaceID dataset.",
          validation: Object.freeze({
            minItems: 1,
            maxItems: 8,
            datasetBindingIdPattern: "^[a-z0-9-]+$",
            datasetAssetIdPrefix: "asset:dataset:",
          }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.faceid.references",
            referenceKind: "dataset-binding",
            supportedDatasetBindingIds: ["faceid-reference"],
            supportsMultiple: true,
          }),
        }),
        Object.freeze({
          id: "weight",
          path: "faceId.weight",
          type: "number",
          required: true,
          defaultValue: faceIdDefaults.weight,
          label: "Identity influence",
          description: "Increase to match the reference face more strongly.",
          validation: Object.freeze({ min: 0, max: 2 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.faceid.weight",
          }),
        }),
        Object.freeze({
          id: "startStepFraction",
          path: "faceId.startStepFraction",
          type: "number",
          required: true,
          defaultValue: faceIdDefaults.startStepFraction,
          label: "Identity start timing",
          description: "Choose when identity guidance begins while rendering.",
          validation: Object.freeze({ min: 0, max: 1 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.faceid.start_at",
            stepRangeNormalized: true,
          }),
        }),
        Object.freeze({
          id: "endStepFraction",
          path: "faceId.endStepFraction",
          type: "number",
          required: true,
          defaultValue: faceIdDefaults.endStepFraction,
          label: "Identity end timing",
          description: "Choose when identity guidance stops while rendering.",
          validation: Object.freeze({ min: 0, max: 1, gtePath: "faceId.startStepFraction" }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.faceid.end_at",
            stepRangeNormalized: true,
          }),
        }),
      ]),
    }),
    Object.freeze({
      groupId: "output",
      groupLabel: "Output",
      entries: Object.freeze([
        Object.freeze({
          id: "resultCount",
          path: "output.resultCount",
          type: "integer",
          required: true,
          defaultValue: outputDefaults.resultCount,
          label: "Number of results",
          description: "How many image options to generate.",
          validation: Object.freeze({ min: 1, max: 4 }),
        }),
        Object.freeze({
          id: "outputTarget",
          path: "output.outputTarget",
          type: "enum",
          required: true,
          defaultValue: outputDefaults.outputTarget,
          label: "Save to",
          description: "Choose where generated images should go by default.",
          validation: Object.freeze({ options: ["history", "download"] }),
        }),
      ]),
    }),
  ]),
  defaultConfig: Object.freeze({
    prompts: Object.freeze({ ...promptDefaults }),
    models: Object.freeze({ ...modelDefaults }),
    generation: Object.freeze({ ...generationDefaults }),
    faceId: Object.freeze({
      enabled: faceIdDefaults.enabled,
      referenceBindings: faceIdDefaults.referenceBindings.map((entry) => Object.freeze({ ...entry })),
      weight: faceIdDefaults.weight,
      startStepFraction: faceIdDefaults.startStepFraction,
      endStepFraction: faceIdDefaults.endStepFraction,
    }),
    output: Object.freeze({ ...outputDefaults }),
  }),
});

export function createComfyImageManipulationDefaultConfig(): ComfyImageManipulationConfig {
  return ComfyImageManipulationConfigSchema.parse({});
}

export function validateComfyImageManipulationConfig(input: unknown): ReadonlyArray<ComfyImageManipulationConfigValidationIssue> {
  const parsed = ComfyImageManipulationConfigSchema.safeParse(normalizeInput(input));
  if (parsed.success) {
    return Object.freeze([]);
  }

  return Object.freeze(parsed.error.issues.map((issue) => {
    const path = issue.path.join(".");
    const scope = issue.code === z.ZodIssueCode.custom ? "cross-field" : "field";
    const code = issue.code === z.ZodIssueCode.custom ? "cross-field-invalid" : "invalid-value";
    return Object.freeze({
      scope,
      code,
      path,
      message: issue.message,
    });
  }));
}

export function resolveComfyImageManipulationConfig(input: unknown): ComfyImageManipulationConfig {
  return ComfyImageManipulationConfigSchema.parse(normalizeInput(input));
}

export function serializeComfyImageManipulationConfig(input: unknown): string {
  const resolved = resolveComfyImageManipulationConfig(input);
  return JSON.stringify(resolved);
}

export function deserializeComfyImageManipulationConfig(serialized: string): ComfyImageManipulationConfig {
  const parsed = JSON.parse(serialized) as unknown;
  return resolveComfyImageManipulationConfig(parsed);
}

export interface ComfyImageManipulationConfigPreview {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly summary: {
    readonly positivePromptPreview: string;
    readonly hasNegativePrompt: boolean;
    readonly modelSummary: string;
    readonly variationStrength: number;
    readonly width: number;
    readonly height: number;
    readonly denoiseStrength: number;
    readonly sampler: ComfySamplerOption;
    readonly scheduler: ComfySchedulerOption;
    readonly cfg: number;
    readonly seed: number;
    readonly resultCount: number;
    readonly outputTarget: "history" | "download";
    readonly faceIdEnabled: boolean;
    readonly faceIdSummary: string;
  };
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trimEnd()}…`;
}

export function createComfyImageManipulationConfigPreview(input: unknown): ComfyImageManipulationConfigPreview {
  const resolved = resolveComfyImageManipulationConfig(input);
  return Object.freeze({
    schemaId: ComfyImageManipulationPropertySchema.id,
    schemaVersion: ComfyImageManipulationPropertySchema.version,
    summary: Object.freeze({
      positivePromptPreview: truncate(resolved.prompts.positivePrompt, 80),
      hasNegativePrompt: resolved.prompts.negativePrompt.trim().length > 0,
      modelSummary: `Base model: ${resolved.models.checkpointModel}; detail model: ${resolved.models.vaeModel}; identity model: ${resolved.models.faceIdModel}`,
      width: resolved.generation.width,
      height: resolved.generation.height,
      denoiseStrength: resolved.generation.denoiseStrength,
      variationStrength: resolved.generation.variationStrength,
      sampler: resolved.generation.sampler,
      scheduler: resolved.generation.scheduler,
      cfg: resolved.generation.cfg,
      seed: resolved.generation.seed,
      resultCount: resolved.output.resultCount,
      outputTarget: resolved.output.outputTarget,
      faceIdEnabled: resolved.faceId.enabled,
      faceIdSummary: resolved.faceId.enabled
        ? `on (${resolved.faceId.referenceBindings.length} reference${resolved.faceId.referenceBindings.length === 1 ? "" : "s"}, influence=${resolved.faceId.weight}, timing=${resolved.faceId.startStepFraction}-${resolved.faceId.endStepFraction})`
        : "disabled",
    }),
  });
}
