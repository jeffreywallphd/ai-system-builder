import {
  type ExecutionOptionCapabilityContract,
  type ResolvedRuntimeExecutionOptions,
  type RuntimeExecutionOptionOverride,
  RuntimeExecutionOptionValuesSchema,
} from "./ExecutionOptionCapabilityContract";
import {
  createRuntimeCapabilityBindingContract,
  type RuntimeCapabilityBindingContract,
} from "./RuntimeCapabilityBindingContract";

export interface ResolveRuntimeCapabilityBindingRequest {
  readonly binding: RuntimeCapabilityBindingContract;
  readonly workflowDefaults?: RuntimeExecutionOptionOverride;
  readonly systemBindings?: RuntimeExecutionOptionOverride;
  readonly runtimeOverrides?: RuntimeExecutionOptionOverride;
}

export interface ResolveRuntimeCapabilityBindingResult {
  readonly resolvedBinding: RuntimeCapabilityBindingContract;
  readonly resolvedExecutionOptions: ResolvedRuntimeExecutionOptions;
}

function assertRequiredOptionPresent(name: string, required: boolean, value: unknown): void {
  if (required && value === undefined) {
    throw new Error(`missing-required-execution-option:${name}`);
  }
}

function assertNumberWithinRange(name: string, value: number | undefined, minimum?: number, maximum?: number): void {
  if (value === undefined) {
    return;
  }
  if (minimum !== undefined && value < minimum) {
    throw new Error(`invalid-execution-option:${name}:value-below-minimum`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new Error(`invalid-execution-option:${name}:value-above-maximum`);
  }
}

function mergeExecutionOptionValues(input: {
  readonly workflowDefaults?: RuntimeExecutionOptionOverride;
  readonly systemBindings?: RuntimeExecutionOptionOverride;
  readonly bindingDefaults: RuntimeExecutionOptionOverride;
  readonly runtimeOverrides?: RuntimeExecutionOptionOverride;
}): RuntimeExecutionOptionOverride {
  return {
    ...input.workflowDefaults,
    ...input.systemBindings,
    ...input.bindingDefaults,
    ...input.runtimeOverrides,
    seed: input.runtimeOverrides?.seed
      ?? input.bindingDefaults.seed
      ?? input.systemBindings?.seed
      ?? input.workflowDefaults?.seed,
    resolution: input.runtimeOverrides?.resolution
      ?? input.bindingDefaults.resolution
      ?? input.systemBindings?.resolution
      ?? input.workflowDefaults?.resolution,
    batch: input.runtimeOverrides?.batch
      ?? input.bindingDefaults.batch
      ?? input.systemBindings?.batch
      ?? input.workflowDefaults?.batch,
    runtime: input.runtimeOverrides?.runtime
      ?? input.bindingDefaults.runtime
      ?? input.systemBindings?.runtime
      ?? input.workflowDefaults?.runtime,
  };
}

function normalizeExecutionOptions(input: {
  readonly capability: ExecutionOptionCapabilityContract;
  readonly mergedValues: RuntimeExecutionOptionOverride;
}): ResolvedRuntimeExecutionOptions {
  const sampler = input.mergedValues.sampler ?? input.capability.sampler.defaultValue;
  assertRequiredOptionPresent("sampler", input.capability.sampler.required, sampler);
  if (sampler && input.capability.sampler.allowedValues.length > 0 && !input.capability.sampler.allowedValues.includes(sampler)) {
    throw new Error("invalid-execution-option:sampler:not-allowed");
  }

  const steps = input.mergedValues.steps ?? (input.capability.steps.defaultValue !== undefined
    ? Math.trunc(input.capability.steps.defaultValue)
    : undefined);
  assertRequiredOptionPresent("steps", input.capability.steps.required, steps);
  assertNumberWithinRange("steps", steps, input.capability.steps.minimum, input.capability.steps.maximum);

  const guidanceScale = input.mergedValues.guidanceScale ?? input.capability.guidanceScale.defaultValue;
  assertRequiredOptionPresent("guidanceScale", input.capability.guidanceScale.required, guidanceScale);
  assertNumberWithinRange(
    "guidanceScale",
    guidanceScale,
    input.capability.guidanceScale.minimum,
    input.capability.guidanceScale.maximum,
  );

  const batchCount = input.mergedValues.batch?.count ?? (input.capability.batch.defaultValue !== undefined
    ? Math.trunc(input.capability.batch.defaultValue)
    : undefined);
  assertRequiredOptionPresent("batch", input.capability.batch.required, batchCount);
  assertNumberWithinRange("batch", batchCount, input.capability.batch.minimum, input.capability.batch.maximum);

  const resolution = input.mergedValues.resolution ?? input.capability.resolution.defaultValue;
  assertRequiredOptionPresent("resolution", input.capability.resolution.required, resolution);
  if (resolution) {
    assertNumberWithinRange(
      "resolution.width",
      resolution.width,
      input.capability.resolution.minimumWidth,
      input.capability.resolution.maximumWidth,
    );
    assertNumberWithinRange(
      "resolution.height",
      resolution.height,
      input.capability.resolution.minimumHeight,
      input.capability.resolution.maximumHeight,
    );
    if (input.capability.resolution.widthStep && resolution.width % input.capability.resolution.widthStep !== 0) {
      throw new Error("invalid-execution-option:resolution.width:step-mismatch");
    }
    if (input.capability.resolution.heightStep && resolution.height % input.capability.resolution.heightStep !== 0) {
      throw new Error("invalid-execution-option:resolution.height:step-mismatch");
    }
  }

  const seed = input.mergedValues.seed ?? input.capability.seed.defaultValue;
  assertRequiredOptionPresent("seed", input.capability.seed.required, seed);
  if (seed?.mode === "deterministic" && !input.capability.seed.allowDeterministic) {
    throw new Error("invalid-execution-option:seed:deterministic-disabled");
  }
  if (seed?.mode === "random" && !input.capability.seed.allowRandom) {
    throw new Error("invalid-execution-option:seed:random-disabled");
  }

  const runtime = input.mergedValues.runtime ?? input.capability.runtime.defaultValue;
  assertRequiredOptionPresent("runtime", input.capability.runtime.required, runtime);
  if (runtime) {
    if (!input.capability.runtime.allowedDevices.includes(runtime.device)) {
      throw new Error("invalid-execution-option:runtime.device:not-allowed");
    }
    if (!input.capability.runtime.allowedPrecisions.includes(runtime.precision)) {
      throw new Error("invalid-execution-option:runtime.precision:not-allowed");
    }
  }

  const parsed = RuntimeExecutionOptionValuesSchema.parse({
    sampler,
    steps,
    seed,
    guidanceScale,
    resolution,
    batch: batchCount ? { count: batchCount } : undefined,
    runtime,
  });

  return Object.freeze({ ...parsed, resolution: parsed.resolution ? Object.freeze({ ...parsed.resolution }) : undefined, batch: parsed.batch ? Object.freeze({ ...parsed.batch }) : undefined, runtime: parsed.runtime ? Object.freeze({ ...parsed.runtime }) : undefined, seed: parsed.seed ? Object.freeze({ ...parsed.seed }) : undefined });
}

export function resolveRuntimeCapabilityBinding(
  request: ResolveRuntimeCapabilityBindingRequest,
): ResolveRuntimeCapabilityBindingResult {
  const mergedValues = mergeExecutionOptionValues({
    workflowDefaults: request.workflowDefaults,
    systemBindings: request.systemBindings,
    bindingDefaults: request.binding.executionOptions,
    runtimeOverrides: request.runtimeOverrides,
  });

  const resolvedExecutionOptions = normalizeExecutionOptions({
    capability: request.binding.executionOptionCapability,
    mergedValues,
  });

  const resolvedBinding = createRuntimeCapabilityBindingContract({
    ...request.binding,
    executionOptions: resolvedExecutionOptions,
  });

  return Object.freeze({
    resolvedBinding,
    resolvedExecutionOptions,
  });
}
