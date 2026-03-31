import { z } from "zod";
import type {
  ITransformationAsset,
  ITransformationConfig,
  ITransformationInput,
  ITransformationOutput,
} from "./TransformationContracts";
import { TransformationConfigSchema, TransformationInputSchema } from "./TransformationContracts";
import type { TransformationAssetRegistry } from "./TransformationAssetRegistry";
import {
  normalizeTransformationPipelineError,
  samplePipelineData,
  summarizeTransformationData,
  type TransformationDataSummary,
  type TransformationPipelineErrorDetails,
} from "./TransformationPipelineUtils";

export const TransformationPipelineFailureModes = Object.freeze({
  stopOnError: "stop-on-error",
} as const);

export type TransformationPipelineFailureMode =
  typeof TransformationPipelineFailureModes[keyof typeof TransformationPipelineFailureModes];

export interface TransformationPipelineStep {
  readonly asset: ITransformationAsset;
  readonly config?: ITransformationConfig;
  readonly stepId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TransformationPipelineStepDefinition {
  readonly stepId: string;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly config?: ITransformationConfig;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TransformationPipelineDefinition {
  readonly pipelineId: string;
  readonly steps: ReadonlyArray<TransformationPipelineStepDefinition>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly failureMode?: TransformationPipelineFailureMode;
}

export interface TransformationPipelineStepOutputSummary {
  readonly input: TransformationDataSummary;
  readonly output: TransformationDataSummary;
}

export interface TransformationPipelineExecutionStepResult {
  readonly stepId: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly status: "succeeded" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outputSummary?: TransformationPipelineStepOutputSummary;
  readonly warningMessages: ReadonlyArray<string>;
  readonly error?: TransformationPipelineErrorDetails;
}

export interface TransformationPipelineResult {
  readonly status: "succeeded" | "failed";
  readonly finalOutput?: ITransformationOutput;
  readonly outputs: ReadonlyArray<ITransformationOutput>;
  readonly outputsByStepId: Readonly<Record<string, ITransformationOutput>>;
  readonly steps: ReadonlyArray<TransformationPipelineExecutionStepResult>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly failureMode: TransformationPipelineFailureMode;
  readonly pipelineId?: string;
  readonly error?: TransformationPipelineErrorDetails;
}

export interface TransformationPipelinePreviewOptions {
  readonly sampleSize?: number;
  readonly sampleSizePerStep?: number;
}

export interface TransformationPipelinePreviewStep {
  readonly stepId: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly status: "succeeded" | "failed";
  readonly summary?: TransformationPipelineStepOutputSummary;
  readonly warningMessages: ReadonlyArray<string>;
  readonly error?: TransformationPipelineErrorDetails;
}

export interface TransformationPipelinePreviewResult {
  readonly status: "succeeded" | "failed";
  readonly pipelineId?: string;
  readonly failureMode: TransformationPipelineFailureMode;
  readonly inputSummary: TransformationDataSummary;
  readonly outputSummary?: TransformationDataSummary;
  readonly steps: ReadonlyArray<TransformationPipelinePreviewStep>;
  readonly finalPreviewData?: ITransformationInput["data"];
  readonly error?: TransformationPipelineErrorDetails;
}

export const TransformationPipelineStepDefinitionSchema: z.ZodType<TransformationPipelineStepDefinition> = z.object({
  stepId: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  assetVersion: z.string().trim().min(1).optional(),
  config: TransformationConfigSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const TransformationPipelineDefinitionSchema: z.ZodType<TransformationPipelineDefinition> = z.object({
  pipelineId: z.string().trim().min(1),
  steps: z.array(TransformationPipelineStepDefinitionSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
  failureMode: z.enum([TransformationPipelineFailureModes.stopOnError]).default(TransformationPipelineFailureModes.stopOnError),
}).superRefine((value, ctx) => {
  const seenStepIds = new Set<string>();
  value.steps.forEach((step, index) => {
    if (seenStepIds.has(step.stepId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps", index, "stepId"],
        message: `Duplicate pipeline step id '${step.stepId}' is not allowed.`,
      });
    }
    seenStepIds.add(step.stepId);
  });
});

interface ResolvedTransformationPipelineStep {
  readonly stepId: string;
  readonly asset: ITransformationAsset;
  readonly config: ITransformationConfig;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function resolveFailureMode(mode?: TransformationPipelineFailureMode): TransformationPipelineFailureMode {
  return mode ?? TransformationPipelineFailureModes.stopOnError;
}

function normalizeDirectSteps(steps: ReadonlyArray<TransformationPipelineStep>): ReadonlyArray<ResolvedTransformationPipelineStep> {
  if (steps.length === 0) {
    throw new Error("Transformation pipeline requires at least one step.");
  }

  return Object.freeze(steps.map((step, index) => {
    const stepId = step.stepId?.trim() || `step-${index + 1}`;
    if (!stepId) {
      throw new Error(`Pipeline step at index ${index} has an empty step id.`);
    }

    return Object.freeze({
      stepId,
      asset: step.asset,
      config: TransformationConfigSchema.parse(step.config ?? {}),
      metadata: step.metadata,
    });
  }));
}

function resolveDefinitionSteps(
  definition: TransformationPipelineDefinition,
  registry: TransformationAssetRegistry,
): ReadonlyArray<ResolvedTransformationPipelineStep> {
  const parsedDefinition = TransformationPipelineDefinitionSchema.parse(definition);
  return Object.freeze(parsedDefinition.steps.map((step) => {
    const resolved = registry.get({ id: step.assetId, version: step.assetVersion });
    if (!resolved) {
      throw new Error(
        `Transformation pipeline step '${step.stepId}' references unregistered asset '${step.assetId}'${step.assetVersion ? `@${step.assetVersion}` : ""}.`,
      );
    }

    return Object.freeze({
      stepId: step.stepId,
      asset: resolved.asset,
      config: TransformationConfigSchema.parse(step.config ?? {}),
      metadata: step.metadata,
    });
  }));
}

function buildStepOutputSummary(input: ITransformationInput, output: ITransformationOutput): TransformationPipelineStepOutputSummary {
  return Object.freeze({
    input: summarizeTransformationData(input.data),
    output: summarizeTransformationData(output.data),
  });
}

function recordSucceededStep(input: {
  readonly step: ResolvedTransformationPipelineStep;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly summary: TransformationPipelineStepOutputSummary;
}): TransformationPipelineExecutionStepResult {
  return Object.freeze({
    stepId: input.step.stepId,
    assetId: input.step.asset.id,
    assetVersion: input.step.asset.version,
    status: "succeeded",
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    durationMs: input.completedAt.getTime() - input.startedAt.getTime(),
    outputSummary: input.summary,
    warningMessages: Object.freeze([]),
  });
}

function recordFailedStep(input: {
  readonly step: ResolvedTransformationPipelineStep;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly error: unknown;
}): TransformationPipelineExecutionStepResult {
  return Object.freeze({
    stepId: input.step.stepId,
    assetId: input.step.asset.id,
    assetVersion: input.step.asset.version,
    status: "failed",
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    durationMs: input.completedAt.getTime() - input.startedAt.getTime(),
    warningMessages: Object.freeze([]),
    error: normalizeTransformationPipelineError(input.error),
  });
}

async function executeResolvedPipeline(
  input: ITransformationInput,
  steps: ReadonlyArray<ResolvedTransformationPipelineStep>,
  options?: Readonly<{ pipelineId?: string; failureMode?: TransformationPipelineFailureMode }>,
): Promise<TransformationPipelineResult> {
  const parsedInput = TransformationInputSchema.parse(input);
  const startedAt = new Date();
  const failureMode = resolveFailureMode(options?.failureMode);
  const outputs: ITransformationOutput[] = [];
  const outputsByStepId: Record<string, ITransformationOutput> = {};
  const stepResults: TransformationPipelineExecutionStepResult[] = [];

  let nextInput: ITransformationInput = parsedInput;
  let pipelineError: TransformationPipelineErrorDetails | undefined;
  for (const step of steps) {
    const stepStartedAt = new Date();

    try {
      step.asset.configSchema.parse(step.config ?? {});
      const output = await step.asset.execute(nextInput, step.config);
      const stepCompletedAt = new Date();
      const summary = buildStepOutputSummary(nextInput, output);
      outputs.push(output);
      outputsByStepId[step.stepId] = output;
      stepResults.push(recordSucceededStep({
        step,
        startedAt: stepStartedAt,
        completedAt: stepCompletedAt,
        summary,
      }));
      nextInput = Object.freeze({ data: output.data });
    } catch (error) {
      const stepCompletedAt = new Date();
      const failedStep = recordFailedStep({
        step,
        startedAt: stepStartedAt,
        completedAt: stepCompletedAt,
        error,
      });
      stepResults.push(failedStep);
      pipelineError = failedStep.error;
      if (failureMode === TransformationPipelineFailureModes.stopOnError) {
        break;
      }
    }
  }

  const completedAt = new Date();
  return Object.freeze({
    status: pipelineError ? "failed" : "succeeded",
    finalOutput: outputs.length > 0 ? outputs[outputs.length - 1] : undefined,
    outputs: Object.freeze(outputs),
    outputsByStepId: Object.freeze({ ...outputsByStepId }),
    steps: Object.freeze(stepResults),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    failureMode,
    pipelineId: options?.pipelineId,
    error: pipelineError,
  });
}

async function previewResolvedPipeline(
  input: ITransformationInput,
  steps: ReadonlyArray<ResolvedTransformationPipelineStep>,
  options?: Readonly<{ pipelineId?: string; failureMode?: TransformationPipelineFailureMode } & TransformationPipelinePreviewOptions>,
): Promise<TransformationPipelinePreviewResult> {
  const parsedInput = TransformationInputSchema.parse(input);
  const failureMode = resolveFailureMode(options?.failureMode);
  const stepPreviews: TransformationPipelinePreviewStep[] = [];
  const inputSummary = summarizeTransformationData(parsedInput.data);

  let nextInput: ITransformationInput = parsedInput;
  let pipelineError: TransformationPipelineErrorDetails | undefined;

  for (const step of steps) {
    const sampledInputData = samplePipelineData(nextInput.data, options?.sampleSizePerStep ?? options?.sampleSize);
    const sampledInput = Object.freeze({ data: sampledInputData } satisfies ITransformationInput);

    try {
      step.asset.configSchema.parse(step.config ?? {});
      const preview = await step.asset.preview(sampledInput, step.config);
      const summary = buildStepOutputSummary(sampledInput, preview.output);
      stepPreviews.push(Object.freeze({
        stepId: step.stepId,
        assetId: step.asset.id,
        assetVersion: step.asset.version,
        status: "succeeded",
        summary,
        warningMessages: Object.freeze([]),
      }));
      nextInput = Object.freeze({ data: preview.output.data });
    } catch (error) {
      const normalized = normalizeTransformationPipelineError(error);
      stepPreviews.push(Object.freeze({
        stepId: step.stepId,
        assetId: step.asset.id,
        assetVersion: step.asset.version,
        status: "failed",
        warningMessages: Object.freeze([]),
        error: normalized,
      }));
      pipelineError = normalized;
      if (failureMode === TransformationPipelineFailureModes.stopOnError) {
        break;
      }
    }
  }

  const finalPreviewData = samplePipelineData(nextInput.data, options?.sampleSize);

  return Object.freeze({
    status: pipelineError ? "failed" : "succeeded",
    pipelineId: options?.pipelineId,
    failureMode,
    inputSummary,
    outputSummary: summarizeTransformationData(nextInput.data),
    steps: Object.freeze(stepPreviews),
    finalPreviewData,
    error: pipelineError,
  });
}

export async function executeTransformationPipeline(
  input: ITransformationInput,
  steps: ReadonlyArray<TransformationPipelineStep>,
): Promise<TransformationPipelineResult> {
  const normalizedSteps = normalizeDirectSteps(steps);
  return executeResolvedPipeline(input, normalizedSteps);
}

export async function executeTransformationPipelineDefinition(
  input: ITransformationInput,
  definition: TransformationPipelineDefinition,
  registry: TransformationAssetRegistry,
): Promise<TransformationPipelineResult> {
  const parsedDefinition = TransformationPipelineDefinitionSchema.parse(definition);
  const steps = resolveDefinitionSteps(parsedDefinition, registry);
  return executeResolvedPipeline(input, steps, {
    pipelineId: parsedDefinition.pipelineId,
    failureMode: parsedDefinition.failureMode,
  });
}

export async function previewTransformationPipeline(
  input: ITransformationInput,
  steps: ReadonlyArray<TransformationPipelineStep>,
  options?: TransformationPipelinePreviewOptions,
): Promise<TransformationPipelinePreviewResult> {
  const normalizedSteps = normalizeDirectSteps(steps);
  return previewResolvedPipeline(input, normalizedSteps, options);
}

export async function previewTransformationPipelineDefinition(
  input: ITransformationInput,
  definition: TransformationPipelineDefinition,
  registry: TransformationAssetRegistry,
  options?: TransformationPipelinePreviewOptions,
): Promise<TransformationPipelinePreviewResult> {
  const parsedDefinition = TransformationPipelineDefinitionSchema.parse(definition);
  const steps = resolveDefinitionSteps(parsedDefinition, registry);
  return previewResolvedPipeline(input, steps, {
    ...options,
    pipelineId: parsedDefinition.pipelineId,
    failureMode: parsedDefinition.failureMode,
  });
}
