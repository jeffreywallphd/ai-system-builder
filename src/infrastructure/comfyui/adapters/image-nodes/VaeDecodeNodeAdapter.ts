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

const ADAPTER_ID = "image.vae-decode";
const ADAPTER_VERSION = "1.0.0";

const VAE_DECODE_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "vae-decode",
    version: ADAPTER_VERSION,
    displayName: "VAE Decode",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    versionedInputs: false,
    deterministicByDefault: true,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "latent", type: "latent", required: true, inspectable: true }),
    Object.freeze({ id: "model", type: "model", required: true, inspectable: true }),
    Object.freeze({ id: "metadata", type: "metadata", required: false, inspectable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", inspectable: true, previewable: true }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: true }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "vae", "decode"]),
  }),
});

export class VaeDecodeNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = VAE_DECODE_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "VAEDecode";
  }

  protected mapRequestInputs(request: IImageNodeExecutionRequest, context?: IComfyNodeExecutionContext) {
    const latent = this.requireLatent(request.inputs.latent);
    const model = this.requireModel(request.inputs.model);

    return Object.freeze({
      samples: latent.latentRef,
      vae: model.runtimeBindingRef ?? model.modelRef,
      loomRuntimeHints: context?.runtimeOptions,
    });
  }

  protected mapResultOutputs(request: IImageNodeExecutionRequest, result: IComfyNodeExecutionResult) {
    const latent = this.requireLatent(request.inputs.latent);
    const model = this.requireModel(request.inputs.model);
    const metadata = this.readMetadata(request.inputs.metadata);
    const image = this.resolveOutputImage(result.outputs.image, latent);

    return Object.freeze([
      Object.freeze({
        outputId: "image",
        value: image,
        preview: Object.freeze({
          kind: "image",
          width: image.width,
          height: image.height,
          mimeType: image.mimeType,
        }),
        inspection: Object.freeze({
          mode: "decode",
          width: image.width,
          height: image.height,
        }),
      }),
      Object.freeze({
        outputId: "metadata",
        value: Object.freeze({
          ...metadata,
          mode: "decode",
          latentRef: latent.latentRef,
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
    const latent = this.readLatent(request.inputs.latent);
    return Object.freeze({
      tags: [this.contract.identity.kind, "comfyui-adapter", "vae"],
      summary: {
        nodeId: this.contract.identity.id,
        nodeVersion: this.contract.identity.version,
        runtime: "comfyui",
        mode: "decode",
      },
      diagnostics: {
        latentRef: latent?.latentRef,
        latentWidth: latent?.width,
        latentHeight: latent?.height,
        executionId: context?.executionId,
      },
    });
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "VAE decode node execution failed.";
    const lower = message.toLowerCase();
    const isValidation =
      lower.includes("latent") ||
      lower.includes("model") ||
      lower.includes("vae") ||
      lower.includes("image");

    return Object.freeze({
      code: isValidation ? "vae-decode-invalid" : "vae-decode-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId, mode: "decode" }),
    });
  }

  private requireLatent(value: unknown): ICommonImageNodeLatentRepresentation {
    const latent = this.readLatent(value);
    if (!latent) {
      throw new Error("VAE decode node input 'latent' is required.");
    }
    return latent;
  }

  private readLatent(value: unknown): ICommonImageNodeLatentRepresentation | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const latent = value as ICommonImageNodeLatentRepresentation;
    if (typeof latent.latentRef !== "string" || latent.latentRef.trim().length === 0) {
      throw new Error("VAE decode node input 'latent.latentRef' must be a non-empty string.");
    }

    return latent;
  }

  private requireModel(value: unknown): ICommonImageNodeModelCapabilityRef {
    if (!value || typeof value !== "object") {
      throw new Error("VAE decode node requires a loaded model capability input.");
    }

    const model = value as ICommonImageNodeModelCapabilityRef;
    if (typeof model.modelRef !== "string" || model.modelRef.trim().length === 0) {
      throw new Error("VAE decode node model capability is missing modelRef.");
    }

    return model;
  }

  private resolveOutputImage(
    value: unknown,
    latent: ICommonImageNodeLatentRepresentation,
  ): ICommonImageNodeInternalImage {
    if (value && typeof value === "object") {
      const image = value as ICommonImageNodeInternalImage;
      if (image.buffer instanceof Uint8Array && image.buffer.byteLength > 0) {
        return image;
      }
    }

    const width = latent.width ?? 64;
    const height = latent.height ?? 64;

    return Object.freeze({
      buffer: new Uint8Array([0]),
      width,
      height,
      format: "png",
      mimeType: "image/png",
      filename: `${latent.latentRef.replace(/[^a-z0-9-_.:]/gi, "_")}.png`,
    });
  }

  private readMetadata(value: unknown): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object") {
      return Object.freeze({});
    }

    return Object.freeze({ ...(value as Record<string, unknown>) });
  }
}

