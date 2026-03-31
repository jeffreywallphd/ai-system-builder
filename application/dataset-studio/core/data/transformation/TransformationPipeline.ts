import type {
  ITransformationAsset,
  ITransformationConfig,
  ITransformationInput,
  ITransformationOutput,
} from "./TransformationContracts";

export interface TransformationPipelineStep {
  readonly asset: ITransformationAsset;
  readonly config?: ITransformationConfig;
}

export interface TransformationPipelineResult {
  readonly finalOutput: ITransformationOutput;
  readonly outputs: ReadonlyArray<ITransformationOutput>;
}

export async function executeTransformationPipeline(
  input: ITransformationInput,
  steps: ReadonlyArray<TransformationPipelineStep>,
): Promise<TransformationPipelineResult> {
  let nextInput = input;
  const outputs: ITransformationOutput[] = [];
  for (const step of steps) {
    const output = await step.asset.execute(nextInput, step.config);
    outputs.push(output);
    nextInput = Object.freeze({ data: output.data });
  }

  if (outputs.length === 0) {
    throw new Error("Transformation pipeline requires at least one step.");
  }

  return Object.freeze({
    finalOutput: outputs[outputs.length - 1]!,
    outputs: Object.freeze(outputs),
  });
}
