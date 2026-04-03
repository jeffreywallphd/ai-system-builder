import { z } from "zod";

export const ComfyImageManipulationPropertySchemaId = "property-schema:image-manipulation";
export const ComfyImageManipulationPropertySchemaVersion = "1.1.0";

export const ComfyConditioningMapping = Object.freeze({
  positivePrompt: "desired-features",
  negativePrompt: "features-to-avoid",
} as const);

const promptDefaults = Object.freeze({
  positivePrompt: "A photorealistic portrait with natural lighting and sharp detail",
  negativePrompt: "blurry, distorted face, low quality, extra fingers",
});

const generationDefaults = Object.freeze({
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
    readonly variationStrength: number;
    readonly steps: number;
    readonly cfg: number;
    readonly sampler: ComfySamplerOption;
    readonly scheduler: ComfySchedulerOption;
    readonly seed: number;
  };
  readonly output: {
    readonly resultCount: number;
    readonly outputTarget: "history" | "download";
  };
}

export interface ComfyImageManipulationConfigValidationIssue {
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
    readonly groupId: "prompts" | "models" | "generation" | "output";
    readonly groupLabel: string;
    readonly entries: ReadonlyArray<{
      readonly id: string;
      readonly path: string;
      readonly type: "string" | "number" | "integer" | "enum";
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
    variationStrength: z.number().min(0).max(1).default(generationDefaults.variationStrength),
    steps: z.number().int().min(1).max(200).default(generationDefaults.steps),
    cfg: z.number().min(1).max(30).default(generationDefaults.cfg),
    sampler: z.enum(comfySamplerOptions).default(generationDefaults.sampler),
    scheduler: z.enum(comfySchedulerOptions).default(generationDefaults.scheduler),
    seed: z.number().int().min(0).max(2147483647).default(generationDefaults.seed),
  }).default(generationDefaults),
  output: z.object({
    resultCount: z.number().int().min(1).max(4).default(outputDefaults.resultCount),
    outputTarget: z.enum(["history", "download"]).default(outputDefaults.outputTarget),
  }).default(outputDefaults),
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
          label: "Face reference model",
          description: "Choose the model used when applying face-reference guidance.",
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
          id: "variationStrength",
          path: "generation.variationStrength",
          type: "number",
          required: true,
          defaultValue: generationDefaults.variationStrength,
          label: "Variation strength",
          description: "Controls how much the new image can differ from the source image.",
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
          label: "Prompt strength",
          description: "Controls how strongly the image follows your instructions.",
          validation: Object.freeze({ min: 1, max: 30 }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.cfg",
          }),
        }),
        Object.freeze({
          id: "sampler",
          path: "generation.sampler",
          type: "enum",
          required: true,
          defaultValue: generationDefaults.sampler,
          label: "Sampling method",
          description: "Choose the sampling method used to build each image.",
          validation: Object.freeze({ options: [...comfySamplerOptions] }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.sampler_name",
          }),
        }),
        Object.freeze({
          id: "scheduler",
          path: "generation.scheduler",
          type: "enum",
          required: true,
          defaultValue: generationDefaults.scheduler,
          label: "Scheduling method",
          description: "Choose how steps are distributed during generation.",
          validation: Object.freeze({ options: [...comfySchedulerOptions] }),
          metadata: Object.freeze({
            runtimeBinding: "comfy.scheduler",
          }),
        }),
        Object.freeze({
          id: "seed",
          path: "generation.seed",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.seed,
          label: "Seed",
          description: "Use the same number to repeat results, or change it for a new variation.",
          validation: Object.freeze({ min: 0, max: 2147483647 }),
          metadata: Object.freeze({
            deterministicByDefault: true,
            randomizationMode: "future-compatible",
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

  return Object.freeze(parsed.error.issues.map((issue) => Object.freeze({
    path: issue.path.join("."),
    message: issue.message,
  })));
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
    readonly sampler: ComfySamplerOption;
    readonly scheduler: ComfySchedulerOption;
    readonly cfg: number;
    readonly seed: number;
    readonly resultCount: number;
    readonly outputTarget: "history" | "download";
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
      modelSummary: `base=${resolved.models.checkpointModel}, vae=${resolved.models.vaeModel}, face=${resolved.models.faceIdModel}`,
      variationStrength: resolved.generation.variationStrength,
      sampler: resolved.generation.sampler,
      scheduler: resolved.generation.scheduler,
      cfg: resolved.generation.cfg,
      seed: resolved.generation.seed,
      resultCount: resolved.output.resultCount,
      outputTarget: resolved.output.outputTarget,
    }),
  });
}
