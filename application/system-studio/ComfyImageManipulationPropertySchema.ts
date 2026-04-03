import { z } from "zod";

export const ComfyImageManipulationPropertySchemaId = "property-schema:image-manipulation";
export const ComfyImageManipulationPropertySchemaVersion = "1.0.0";

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
  guidance: 7,
  seed: -1,
});

const outputDefaults = Object.freeze({
  resultCount: 1,
  outputTarget: "history",
});

export interface ComfyImageManipulationConfig {
  readonly prompts: {
    readonly positivePrompt: string;
    readonly negativePrompt: string;
  };
  readonly generation: {
    readonly variationStrength: number;
    readonly steps: number;
    readonly guidance: number;
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
    readonly groupId: "prompts" | "generation" | "output";
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
    }>;
  }>;
  readonly defaultConfig: ComfyImageManipulationConfig;
}

const ComfyImageManipulationConfigSchema = z.object({
  prompts: z.object({
    positivePrompt: z.string().trim().min(1, "Describe what you want to create is required.").default(promptDefaults.positivePrompt),
    negativePrompt: z.string().trim().default(promptDefaults.negativePrompt),
  }).default(promptDefaults),
  generation: z.object({
    variationStrength: z.number().min(0).max(1).default(generationDefaults.variationStrength),
    steps: z.number().int().min(1).max(200).default(generationDefaults.steps),
    guidance: z.number().min(0).max(30).default(generationDefaults.guidance),
    seed: z.number().int().default(generationDefaults.seed),
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
          id: "guidance",
          path: "generation.guidance",
          type: "number",
          required: true,
          defaultValue: generationDefaults.guidance,
          label: "Prompt guidance",
          description: "Controls how strongly the image follows your description.",
          validation: Object.freeze({ min: 0, max: 30 }),
        }),
        Object.freeze({
          id: "seed",
          path: "generation.seed",
          type: "integer",
          required: true,
          defaultValue: generationDefaults.seed,
          label: "Seed",
          description: "Use -1 for a fresh variation each run, or set a number for repeatability.",
          validation: Object.freeze({ minimum: -1 }),
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
    readonly variationStrength: number;
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
      variationStrength: resolved.generation.variationStrength,
      resultCount: resolved.output.resultCount,
      outputTarget: resolved.output.outputTarget,
    }),
  });
}
