import type {
  GenerateResultPreviewDerivativeRequest,
  GenerateResultPreviewDerivativeResult,
  IGeneratedResultPreviewImageProcessorPort,
} from "@application/generated-results/ports/GeneratedResultPreviewGenerationPorts";

type SharpFactory = typeof import("sharp").default;

let cachedSharpFactory: SharpFactory | undefined;
let sharpFactoryLoadPromise: Promise<SharpFactory | undefined> | undefined;

async function resolveSharpFactory(): Promise<SharpFactory | undefined> {
  if (cachedSharpFactory) {
    return cachedSharpFactory;
  }
  if (sharpFactoryLoadPromise) {
    return sharpFactoryLoadPromise;
  }

  sharpFactoryLoadPromise = (async () => {
    try {
      const sharpRecord = await import("sharp") as Readonly<Record<string, unknown>>;
      const candidate = (sharpRecord.default ?? sharpRecord) as SharpFactory | undefined;
      if (typeof candidate === "function") {
        cachedSharpFactory = candidate;
      }
      return cachedSharpFactory;
    } catch {
      return undefined;
    } finally {
      sharpFactoryLoadPromise = undefined;
    }
  })();

  return sharpFactoryLoadPromise;
}

export class SharpGeneratedResultPreviewImageProcessor implements IGeneratedResultPreviewImageProcessorPort {
  public async generatePreviewDerivative(
    request: GenerateResultPreviewDerivativeRequest,
  ): Promise<GenerateResultPreviewDerivativeResult> {
    const sharpFactory = await resolveSharpFactory();
    if (!sharpFactory) {
      throw new Error("Preview derivative generation is unavailable.");
    }

    const transformed = sharpFactory(request.sourceContent, {
      failOn: "error",
      limitInputPixels: false,
    })
      .rotate()
      .resize({
        width: request.profile.maxWidth,
        height: request.profile.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: request.profile.quality,
      });

    const result = await transformed.toBuffer({
      resolveWithObject: true,
    });

    const width = result.info.width ?? 1;
    const height = result.info.height ?? 1;
    const byteSize = result.data.byteLength;

    if (byteSize < 1 || width < 1 || height < 1) {
      throw new Error("Preview derivative generation produced invalid dimensions or byte size.");
    }

    return Object.freeze({
      content: result.data,
      mediaType: "image/webp",
      width,
      height,
      byteSize,
    });
  }
}
