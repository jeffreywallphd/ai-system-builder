import type {
  ICommonImageNodeContract,
  ICommonImageNodeInternalImage,
  ICommonImageNodeLatentRepresentation,
  ICommonImageNodeModelCapabilityRef,
  IImageNodeExecutionRequest,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const ADAPTER_ID = "image.vae-encode";
const ADAPTER_VERSION = "1.0.0";

const VAE_ENCODE_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "vae-encode",
    version: ADAPTER_VERSION,
    displayName: "VAE Encode",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: false,
    versionedInputs: false,
    deterministicByDefault: true,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", required: true, inspectable: true, previewable: true }),
    Object.freeze({ id: "model", type: "model", required: true, inspectable: true }),
    Object.freeze({ id: "metadata", type: "metadata", required: false, inspectable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "latent", type: "latent", inspectable: true }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: true }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "vae", "encode"]),
  }),
});

export class VaeEncodeNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = VAE_ENCODE_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "VAEEncode";
  }

  protected mapRequestInputs(request: IImageNodeExecutionRequest, context?: IComfyNodeExecutionContext) {
    const image = this.requireImage(request.inputs.image);
    const model = this.requireModel(request.inputs.model);

    return Object.freeze({
      pixels: Object.freeze({
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
      }),
      vae: model.runtimeBindingRef ?? model.modelRef,
      loomRuntimeHints: context?.runtimeOptions,
    });
  }

  protected mapResultOutputs(request: IImageNodeExecutionRequest, result: IComfyNodeExecutionResult) {
    const image = this.requireImage(request.inputs.image);
    const model = this.requireModel(request.inputs.model);
    const metadata = this.readMetadata(request.inputs.metadata);

    const latent = this.toInternalLatent(result.outputs, image, model);

    return Object.freeze([
      Object.freeze({
        outputId: "latent",
        value: latent,
        inspection: Object.freeze({
          mode: "encode",
          width: latent.width,
          height: latent.height,
          latentRef: latent.latentRef,
        }),
      }),
      Object.freeze({
        outputId: "metadata",
        value: Object.freeze({
          ...metadata,
          mode: "encode",
          sourceImage: {
            width: image.width,
            height: image.height,
            mimeType: image.mimeType,
          },
          vae: {
            modelRef: model.modelRef,
            runtimeBindingRef: model.runtimeBindingRef,
          },
          adapter: {
            id: ADAPTER_ID,
            version: ADAPTER_VERSION,
          },
        }),
      }),
    ]);
  }

  public inspect(request: IImageNodeExecutionRequest, context?: IComfyNodeExecutionContext) {
    const image = this.readImage(request.inputs.image);
    return Object.freeze({
      tags: [this.contract.identity.kind, "comfyui-adapter", "vae"],
      summary: {
        nodeId: this.contract.identity.id,
        nodeVersion: this.contract.identity.version,
        runtime: "comfyui",
        mode: "encode",
      },
      diagnostics: {
        imageWidth: image?.width,
        imageHeight: image?.height,
        executionId: context?.executionId,
      },
    });
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "VAE encode node execution failed.";
    const lower = message.toLowerCase();
    const isValidation =
      lower.includes("image") ||
      lower.includes("model") ||
      lower.includes("vae") ||
      lower.includes("latent");

    return Object.freeze({
      code: isValidation ? "vae-encode-invalid" : "vae-encode-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId, mode: "encode" }),
    });
  }

  private toInternalLatent(
    outputs: Readonly<Record<string, unknown>>,
    image: ICommonImageNodeInternalImage,
    model: ICommonImageNodeModelCapabilityRef,
  ): ICommonImageNodeLatentRepresentation {
    const latentRef = this.readText(outputs.latent) ?? this.readText(outputs.samples) ?? "latent:vae-encode";
    return Object.freeze({
      latentRef,
      width: image.width,
      height: image.height,
      source: "vae-encode",
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      metadata: Object.freeze({
        modelRef: model.modelRef,
      }),
    });
  }

  private requireImage(value: unknown): ICommonImageNodeInternalImage {
    const image = this.readImage(value);
    if (!image) {
      throw new Error("VAE encode node input 'image' is required.");
    }
    return image;
  }

  private readImage(value: unknown): ICommonImageNodeInternalImage | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const image = value as ICommonImageNodeInternalImage;
    if (!(image.buffer instanceof Uint8Array) || image.buffer.byteLength === 0) {
      throw new Error("VAE encode node input 'image.buffer' must be a non-empty Uint8Array.");
    }

    return image;
  }

  private requireModel(value: unknown): ICommonImageNodeModelCapabilityRef {
    if (!value || typeof value !== "object") {
      throw new Error("VAE encode node requires a loaded model capability input.");
    }

    const model = value as ICommonImageNodeModelCapabilityRef;
    if (typeof model.modelRef !== "string" || model.modelRef.trim().length === 0) {
      throw new Error("VAE encode node model capability is missing modelRef.");
    }

    return model;
  }

  private readText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private readMetadata(value: unknown): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object") {
      return Object.freeze({});
    }

    return Object.freeze({ ...(value as Record<string, unknown>) });
  }
}

