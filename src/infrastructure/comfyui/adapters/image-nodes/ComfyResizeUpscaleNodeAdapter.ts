import type {
  ICommonImageNodeContract,
  ICommonImageNodeInternalImage,
  IImageNodeExecutionRequest,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const ADAPTER_ID = "image.resize-upscale";
const ADAPTER_VERSION = "1.0.0";

const RESIZE_UPSCALE_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "resize-upscale",
    version: ADAPTER_VERSION,
    displayName: "Resize/Upscale",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    versionedInputs: false,
    deterministicByDefault: true,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", required: true, inspectable: true, previewable: true }),
    Object.freeze({ id: "metadata", type: "metadata", required: false, inspectable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", inspectable: true, previewable: true }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: true }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([
      Object.freeze({ id: "width", type: "number", required: false }),
      Object.freeze({ id: "height", type: "number", required: false }),
      Object.freeze({ id: "scaleFactor", type: "number", required: false }),
      Object.freeze({ id: "fit", type: "enum", required: false, defaultValue: "fill", options: ["fill", "contain", "cover"] }),
      Object.freeze({ id: "strategy", type: "enum", required: false, defaultValue: "basic", options: ["basic", "latent"] }),
    ]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "resize", "upscale"]),
  }),
});

interface ResizePlan {
  readonly width: number;
  readonly height: number;
  readonly scaleFactor?: number;
  readonly fit: "fill" | "contain" | "cover";
  readonly strategy: "basic" | "latent";
}

export class ComfyResizeUpscaleNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = RESIZE_UPSCALE_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "ImageScale";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const image = this.requireImage(request.inputs.image);
    const plan = this.resolveResizePlan(request, image);

    return Object.freeze({
      image: Object.freeze({
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
      }),
      width: plan.width,
      height: plan.height,
      upscale_method: plan.strategy,
      crop: plan.fit,
    });
  }

  protected mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
  ) {
    const sourceImage = this.requireImage(request.inputs.image);
    const plan = this.resolveResizePlan(request, sourceImage);

    const transformed = this.readTransformedImage(result.outputs.image) ?? Object.freeze({
      ...sourceImage,
      width: plan.width,
      height: plan.height,
      metadata: undefined,
    });

    const sourceMetadata = this.readMetadataInput(request.inputs.metadata);
    const metadata = Object.freeze({
      ...sourceMetadata,
      width: plan.width,
      height: plan.height,
      transform: Object.freeze({
        operation: "resize-upscale",
        scaleFactor: plan.scaleFactor,
        fit: plan.fit,
        strategy: plan.strategy,
        sourceWidth: sourceImage.width,
        sourceHeight: sourceImage.height,
        targetWidth: plan.width,
        targetHeight: plan.height,
      }),
      adapter: Object.freeze({
        id: ADAPTER_ID,
        version: ADAPTER_VERSION,
      }),
    });

    return Object.freeze([
      Object.freeze({
        outputId: "image",
        value: transformed,
        preview: Object.freeze({
          kind: "image",
          width: plan.width,
          height: plan.height,
          mimeType: transformed.mimeType,
        }),
      }),
      Object.freeze({
        outputId: "metadata",
        value: metadata,
        inspection: Object.freeze({
          fit: plan.fit,
          strategy: plan.strategy,
          scaleFactor: plan.scaleFactor,
          sourceWidth: sourceImage.width,
          sourceHeight: sourceImage.height,
          targetWidth: plan.width,
          targetHeight: plan.height,
        }),
      }),
    ]);
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "Resize/upscale node execution failed.";
    const lower = message.toLowerCase();
    const isValidation = lower.includes("width") || lower.includes("height") || lower.includes("scale") || lower.includes("image") || lower.includes("fit") || lower.includes("strategy");

    return Object.freeze({
      code: isValidation ? "resize-upscale-invalid" : "resize-upscale-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId }),
    });
  }

  private requireImage(value: unknown): ICommonImageNodeInternalImage {
    if (!value || typeof value !== "object") {
      throw new Error("Resize/upscale node input 'image' is required.");
    }

    const image = value as ICommonImageNodeInternalImage;
    if (!(image.buffer instanceof Uint8Array) || image.buffer.byteLength === 0) {
      throw new Error("Resize/upscale node input 'image.buffer' must be a non-empty Uint8Array.");
    }
    if (!Number.isInteger(image.width) || (image.width as number) <= 0) {
      throw new Error("Resize/upscale node input 'image.width' must be a positive integer.");
    }
    if (!Number.isInteger(image.height) || (image.height as number) <= 0) {
      throw new Error("Resize/upscale node input 'image.height' must be a positive integer.");
    }

    return image;
  }

  private resolveResizePlan(request: IImageNodeExecutionRequest, image: ICommonImageNodeInternalImage): ResizePlan {
    const fit = this.resolveFit(request.config?.fit);
    const strategy = this.resolveStrategy(request.config?.strategy);
    const scaleFactor = this.optionalPositiveNumber(request.config?.scaleFactor, "scaleFactor");
    const widthFromConfig = this.optionalPositiveInteger(request.config?.width, "width");
    const heightFromConfig = this.optionalPositiveInteger(request.config?.height, "height");

    if (!widthFromConfig && !heightFromConfig && !scaleFactor) {
      throw new Error("Resize/upscale node requires width/height or scaleFactor.");
    }

    const sourceWidth = image.width as number;
    const sourceHeight = image.height as number;
    const computedWidth = widthFromConfig ?? (scaleFactor ? Math.max(1, Math.round(sourceWidth * scaleFactor)) : undefined);
    const computedHeight = heightFromConfig ?? (scaleFactor ? Math.max(1, Math.round(sourceHeight * scaleFactor)) : undefined);

    if (!computedWidth || !computedHeight) {
      throw new Error("Resize/upscale node could not determine target width and height.");
    }

    return Object.freeze({
      width: computedWidth,
      height: computedHeight,
      scaleFactor,
      fit,
      strategy,
    });
  }

  private optionalPositiveInteger(value: unknown, field: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error(`Resize/upscale node config '${field}' must be a positive integer.`);
    }
    return value;
  }

  private optionalPositiveNumber(value: unknown, field: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Resize/upscale node config '${field}' must be a positive number.`);
    }
    return value;
  }

  private resolveFit(value: unknown): ResizePlan["fit"] {
    if (value === undefined) {
      return "fill";
    }
    if (value === "fill" || value === "contain" || value === "cover") {
      return value;
    }
    throw new Error("Resize/upscale node config 'fit' must be one of: fill, contain, cover.");
  }

  private resolveStrategy(value: unknown): ResizePlan["strategy"] {
    if (value === undefined) {
      return "basic";
    }
    if (value === "basic" || value === "latent") {
      return value;
    }
    throw new Error("Resize/upscale node config 'strategy' must be one of: basic, latent.");
  }

  private readMetadataInput(value: unknown): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object") {
      return Object.freeze({});
    }
    return Object.freeze({ ...(value as Record<string, unknown>) });
  }

  private readTransformedImage(value: unknown): ICommonImageNodeInternalImage | undefined {
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
