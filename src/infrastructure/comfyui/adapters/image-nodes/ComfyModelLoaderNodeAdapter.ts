import type {
  ICommonImageNodeContract,
  ICommonImageNodeModelCapabilityRef,
  IImageNodeExecutionRequest,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const ADAPTER_ID = "image.model-loader";
const ADAPTER_VERSION = "1.0.0";

const MODEL_LOADER_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "model-loader",
    version: ADAPTER_VERSION,
    displayName: "Model Loader",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: false,
    versionedInputs: true,
    deterministicByDefault: true,
  }),
  inputContract: Object.freeze([
    Object.freeze({
      id: "modelRef",
      type: "asset-reference",
      required: true,
      inspectable: true,
      description: "Internal model or checkpoint reference.",
    }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({
      id: "model",
      type: "model",
      inspectable: true,
      previewable: false,
      versioned: true,
      description: "Internal loaded model capability reference for downstream adapters.",
    }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([
      Object.freeze({
        id: "modelFamily",
        type: "string",
        required: false,
        description: "Optional abstract model family discriminator.",
      }),
      Object.freeze({
        id: "runtimeBindingRef",
        type: "string",
        required: false,
        description: "Optional runtime capability binding reference.",
      }),
    ]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "model", "loader"]),
  }),
});

export class ComfyModelLoaderNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = MODEL_LOADER_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "CheckpointLoaderSimple";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const modelRef = this.requireText(request.inputs.modelRef, "modelRef");

    return Object.freeze({
      ckpt_name: this.toComfyCheckpointName(modelRef),
    });
  }

  protected mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
    context?: IComfyNodeExecutionContext,
  ) {
    const modelRef = this.requireText(request.inputs.modelRef, "modelRef");
    const modelFamily = this.optionalText(request.config?.modelFamily);
    const runtimeBindingRef = this.resolveRuntimeBindingRef(request, context);

    const capability: ICommonImageNodeModelCapabilityRef = Object.freeze({
      modelRef,
      modelFamily,
      runtimeBindingRef,
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      metadata: Object.freeze({
        loaded: Boolean(result.outputs.model ?? result.outputs.MODEL),
      }),
    });

    return Object.freeze([
      Object.freeze({
        outputId: "model",
        value: capability,
        inspection: Object.freeze({
          selectedModelRef: modelRef,
          modelFamily,
          runtimeBindingRef,
          adapterId: ADAPTER_ID,
          adapterVersion: ADAPTER_VERSION,
        }),
      }),
    ]);
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "Model loader node execution failed.";
    const isValidation = message.toLowerCase().includes("model");
    return Object.freeze({
      code: isValidation ? "model-loader-invalid" : "model-loader-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId }),
    });
  }

  private toComfyCheckpointName(modelRef: string): string {
    const normalized = modelRef.replace(/^asset:[^:]+:/, "").trim();
    return normalized.length > 0 ? normalized : modelRef;
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Model loader node '${field}' must be a non-empty string.`);
    }
    return value.trim();
  }

  private optionalText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private resolveRuntimeBindingRef(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): string | undefined {
    return (
      this.optionalText(request.config?.runtimeBindingRef)
      ?? this.optionalText(context?.runtimeOptions?.modelBindingRef)
      ?? this.optionalText(context?.runtimeOptions?.runtimeBindingRef)
    );
  }
}

