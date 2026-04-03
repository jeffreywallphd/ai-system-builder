import type {
  ICommonImageNodeContract,
  ICommonImageNodeInternalImage,
  ICommonImageNodeLatentRepresentation,
  ICommonImageNodeModelCapabilityRef,
  ICommonImageNodePromptConditioning,
  IImageNodeExecutionRequest,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const ADAPTER_ID = "image.sampler-wrapper";
const ADAPTER_VERSION = "1.0.0";

const SAMPLER_WRAPPER_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "sampler-wrapper",
    version: ADAPTER_VERSION,
    displayName: "Sampler Wrapper",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    versionedInputs: false,
    deterministicByDefault: false,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "model", type: "model", required: true, inspectable: true }),
    Object.freeze({ id: "promptConditioning", type: "conditioning", required: true, inspectable: true }),
    Object.freeze({ id: "sourceImage", type: "image", required: false, inspectable: true, previewable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "latent", type: "latent", inspectable: true, previewable: false }),
    Object.freeze({ id: "image", type: "image", inspectable: true, previewable: true }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: true }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([
      Object.freeze({ id: "steps", type: "number", required: false, defaultValue: 20 }),
      Object.freeze({ id: "guidance", type: "number", required: false, defaultValue: 7 }),
      Object.freeze({ id: "seed", type: "number", required: false, defaultValue: -1 }),
      Object.freeze({ id: "sampler", type: "string", required: false, defaultValue: "euler" }),
      Object.freeze({ id: "scheduler", type: "string", required: false, defaultValue: "normal" }),
      Object.freeze({ id: "strength", type: "number", required: false, defaultValue: 1 }),
    ]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "sampling", "generation"]),
  }),
});

interface ResolvedSamplerConfig {
  readonly steps: number;
  readonly guidance: number;
  readonly seed: number;
  readonly sampler: string;
  readonly scheduler: string;
  readonly strength: number;
}

export class ComfySamplerWrapperNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = SAMPLER_WRAPPER_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "KSampler";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const model = this.requireModel(request.inputs.model);
    const conditioning = this.requireConditioning(request.inputs.promptConditioning);
    const sourceImage = this.optionalImage(request.inputs.sourceImage);
    const samplerConfig = this.resolveSamplerConfig(request.config);

    const mapped: Record<string, unknown> = {
      model: model.runtimeBindingRef ?? model.modelRef,
      positive: conditioning.positivePrompt,
      negative: conditioning.negativePrompt ?? "",
      steps: samplerConfig.steps,
      cfg: samplerConfig.guidance,
      seed: samplerConfig.seed,
      sampler_name: samplerConfig.sampler,
      scheduler: samplerConfig.scheduler,
      denoise: samplerConfig.strength,
    };

    if (sourceImage) {
      mapped.latent_image = Object.freeze({
        width: sourceImage.width,
        height: sourceImage.height,
        mimeType: sourceImage.mimeType,
      });
    }

    if (context?.runtimeOptions) {
      mapped.loomRuntimeHints = context.runtimeOptions;
    }

    return Object.freeze(mapped);
  }

  protected mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
  ) {
    const resolvedConfig = this.resolveSamplerConfig(request.config);
    const sourceImage = this.optionalImage(request.inputs.sourceImage);
    const generatedImage = this.readGeneratedImage(result.outputs.image);
    const outputImage = generatedImage ?? sourceImage;

    const latent: ICommonImageNodeLatentRepresentation = Object.freeze({
      latentRef: this.readText(result.outputs.latent) ?? this.readText(result.outputs.samples) ?? "latent:generated",
      source: "sampler",
      width: outputImage?.width,
      height: outputImage?.height,
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      metadata: Object.freeze({
        generationMode: sourceImage ? "image-to-image" : "text-to-image",
      }),
    });

    return Object.freeze([
      Object.freeze({
        outputId: "latent",
        value: latent,
      }),
      Object.freeze({
        outputId: "image",
        value: outputImage,
        preview: outputImage
          ? Object.freeze({
            kind: "image",
            width: outputImage.width,
            height: outputImage.height,
            mimeType: outputImage.mimeType,
          })
          : undefined,
      }),
      Object.freeze({
        outputId: "metadata",
        value: Object.freeze({
          mode: sourceImage ? "image-to-image" : "text-to-image",
          effectiveConfig: resolvedConfig,
          sampler: {
            adapterId: ADAPTER_ID,
            adapterVersion: ADAPTER_VERSION,
          },
        }),
        inspection: Object.freeze({
          steps: resolvedConfig.steps,
          guidance: resolvedConfig.guidance,
          seed: resolvedConfig.seed,
          sampler: resolvedConfig.sampler,
          scheduler: resolvedConfig.scheduler,
          strength: resolvedConfig.strength,
        }),
      }),
    ]);
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "Sampler wrapper node execution failed.";
    const lower = message.toLowerCase();
    const isValidation = lower.includes("sampler") || lower.includes("prompt") || lower.includes("model") || lower.includes("steps") || lower.includes("guidance") || lower.includes("seed") || lower.includes("strength");

    return Object.freeze({
      code: isValidation ? "sampler-wrapper-invalid" : "sampler-wrapper-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId }),
    });
  }

  private requireModel(value: unknown): ICommonImageNodeModelCapabilityRef {
    if (!value || typeof value !== "object") {
      throw new Error("Sampler wrapper node requires a loaded model capability input.");
    }

    const model = value as ICommonImageNodeModelCapabilityRef;
    if (typeof model.modelRef !== "string" || model.modelRef.trim().length === 0) {
      throw new Error("Sampler wrapper node model capability is missing modelRef.");
    }

    return model;
  }

  private requireConditioning(value: unknown): ICommonImageNodePromptConditioning {
    if (!value || typeof value !== "object") {
      throw new Error("Sampler wrapper node requires promptConditioning input.");
    }

    const conditioning = value as ICommonImageNodePromptConditioning;
    if (typeof conditioning.positivePrompt !== "string" || conditioning.positivePrompt.trim().length === 0) {
      throw new Error("Sampler wrapper node prompt conditioning is missing positivePrompt.");
    }

    return conditioning;
  }

  private optionalImage(value: unknown): ICommonImageNodeInternalImage | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const image = value as ICommonImageNodeInternalImage;
    if (!(image.buffer instanceof Uint8Array) || image.buffer.byteLength === 0) {
      throw new Error("Sampler wrapper node input 'sourceImage.buffer' must be a non-empty Uint8Array.");
    }

    return image;
  }

  private resolveSamplerConfig(config: IImageNodeExecutionRequest["config"]): ResolvedSamplerConfig {
    const steps = this.readIntegerInRange(config?.steps, "steps", 1, 200, 20);
    const guidance = this.readNumberInRange(config?.guidance, "guidance", 0, 50, 7);
    const seed = this.readIntegerInRange(config?.seed, "seed", -1, Number.MAX_SAFE_INTEGER, -1);
    const strength = this.readNumberInRange(config?.strength, "strength", 0, 1, 1);

    const sampler = this.readName(config?.sampler, "sampler", "euler");
    const scheduler = this.readName(config?.scheduler, "scheduler", "normal");

    return Object.freeze({ steps, guidance, seed, sampler, scheduler, strength });
  }

  private readIntegerInRange(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
  ): number {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Sampler wrapper node config '${field}' must be an integer between ${min} and ${max}.`);
    }
    return value;
  }

  private readNumberInRange(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
  ): number {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Sampler wrapper node config '${field}' must be between ${min} and ${max}.`);
    }
    return value;
  }

  private readName(value: unknown, field: string, fallback: string): string {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Sampler wrapper node config '${field}' must be a non-empty string.`);
    }
    return value.trim();
  }

  private readText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private readGeneratedImage(value: unknown): ICommonImageNodeInternalImage | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const image = value as ICommonImageNodeInternalImage;
    if (image.buffer instanceof Uint8Array && image.buffer.byteLength > 0) {
      return image;
    }
    return undefined;
  }
}
