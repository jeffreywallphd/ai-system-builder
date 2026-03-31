import { z } from "zod";
import {
  TransformationConfigSchema,
  type ITransformationAsset,
  type ITransformationConfig,
  type ITransformationInput,
  type ITransformationOutput,
  type ITransformationPreview,
} from "./TransformationContracts";
import { sampleTransformationInputData } from "./TransformationSampling";

export class TransformationAssetExecutionError extends Error {
  public readonly assetId: string;
  public readonly cause?: unknown;

  constructor(assetId: string, message: string, cause?: unknown) {
    super(message);
    this.name = "TransformationAssetExecutionError";
    this.assetId = assetId;
    this.cause = cause;
  }
}

export abstract class BaseTransformationAsset<
  TInput extends ITransformationInput,
  TOutput extends ITransformationOutput,
  TConfig extends ITransformationConfig,
> implements ITransformationAsset<TInput, TOutput, TConfig> {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly version: string;
  public readonly inputSchema: z.ZodType<TInput>;
  public readonly outputSchema: z.ZodType<TOutput>;
  public readonly configSchema: z.ZodType<TConfig>;

  protected constructor(input: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly inputSchema: z.ZodType<TInput>;
    readonly outputSchema: z.ZodType<TOutput>;
    readonly configSchema: z.ZodType<TConfig>;
  }) {
    this.id = input.id.trim();
    this.name = input.name.trim();
    this.description = input.description.trim();
    this.version = input.version.trim();
    this.inputSchema = input.inputSchema;
    this.outputSchema = input.outputSchema;
    this.configSchema = input.configSchema;
  }

  public async execute(input: TInput, config?: Partial<TConfig>): Promise<TOutput> {
    const parsedInput = this.inputSchema.parse(input);
    const parsedConfig = this.parseConfig(config);
    try {
      const result = await this.run(parsedInput, parsedConfig);
      return this.outputSchema.parse(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transformation execution error.";
      throw new TransformationAssetExecutionError(this.id, `${this.id}@${this.version} failed: ${message}`, error);
    }
  }

  public async preview(input: TInput, config?: Partial<TConfig>): Promise<ITransformationPreview<TOutput>> {
    const parsedInput = this.inputSchema.parse(input);
    const parsedConfig = this.parseConfig(config);
    const parsedPreviewSettings = TransformationConfigSchema.parse(config ?? {});
    const sampleSize = typeof parsedPreviewSettings.sampleSize === "number"
      ? parsedPreviewSettings.sampleSize
      : undefined;

    const sampledInput = this.inputSchema.parse({
      ...parsedInput,
      data: sampleTransformationInputData(parsedInput.data, sampleSize),
    });
    const output = await this.execute(sampledInput, parsedConfig);
    return Object.freeze({
      output,
      sample: sampledInput.data,
    });
  }

  protected abstract run(input: TInput, config: TConfig): Promise<TOutput>;

  private parseConfig(config?: Partial<TConfig>): TConfig {
    return this.configSchema.parse(config ?? {});
  }
}
