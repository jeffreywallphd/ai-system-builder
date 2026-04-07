import type {
  IImageTransformer,
  ImageTransformationOptions,
  ImageTransformationResult,
} from "@domain/dataset-studio/interfaces/ImageInspection";

type SharpFactory = (input: Uint8Array) => SharpPipeline;

type SharpPipeline = {
  resize(width?: number, height?: number): SharpPipeline;
  grayscale(value?: boolean): SharpPipeline;
  toFormat(format: string): SharpPipeline;
  toBuffer(opts?: Readonly<Record<string, unknown>>): Promise<
    { data: Uint8Array; info?: { width?: number; height?: number; format?: string } } | Uint8Array
  >;
};

function normalizeTargetFormat(options?: ImageTransformationOptions): string {
  const target = options?.targetFormat ?? "keep";
  return target;
}

function shouldTransform(options?: ImageTransformationOptions): boolean {
  const targetFormat = normalizeTargetFormat(options);
  return Boolean(options?.resizeWidth || options?.resizeHeight || options?.grayscale || targetFormat !== "keep");
}

async function resolveSharpFactory(): Promise<SharpFactory | undefined> {
  try {
    const sharpRecord = await import("sharp") as Readonly<Record<string, unknown>>;
    const candidate = (sharpRecord.default ?? sharpRecord) as SharpFactory | undefined;
    return typeof candidate === "function" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export class SharpImageTransformerAdapter implements IImageTransformer {
  public async transform(
    payload: Uint8Array,
    options?: ImageTransformationOptions,
  ): Promise<ImageTransformationResult> {
    if (!shouldTransform(options)) {
      return Object.freeze({
        payload,
        transformed: false,
      });
    }

    const factory = await resolveSharpFactory();
    if (!factory) {
      throw new Error("Image transformation is unavailable.");
    }

    try {
      let pipeline = factory(payload);
      if (options?.resizeWidth || options?.resizeHeight) {
        pipeline = pipeline.resize(options.resizeWidth, options.resizeHeight);
      }
      if (options?.grayscale) {
        pipeline = pipeline.grayscale(true);
      }

      const targetFormat = normalizeTargetFormat(options);
      if (targetFormat !== "keep") {
        pipeline = pipeline.toFormat(targetFormat);
      }

      const result = await pipeline.toBuffer({ resolveWithObject: true });
      const data = result instanceof Uint8Array ? result : result.data;
      const info = result instanceof Uint8Array ? undefined : result.info;
      return Object.freeze({
        payload: data,
        width: info?.width,
        height: info?.height,
        format: info?.format,
        transformed: true,
      });
    } catch {
      throw new Error("Image transformation failed.");
    }
  }
}

