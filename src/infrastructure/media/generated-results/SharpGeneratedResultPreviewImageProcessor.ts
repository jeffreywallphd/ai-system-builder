import sharp from "sharp";
import type {
  GenerateResultPreviewDerivativeRequest,
  GenerateResultPreviewDerivativeResult,
  IGeneratedResultPreviewImageProcessorPort,
} from "@application/generated-results/ports/GeneratedResultPreviewGenerationPorts";

export class SharpGeneratedResultPreviewImageProcessor implements IGeneratedResultPreviewImageProcessorPort {
  public async generatePreviewDerivative(
    request: GenerateResultPreviewDerivativeRequest,
  ): Promise<GenerateResultPreviewDerivativeResult> {
    const transformed = sharp(request.sourceContent, {
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
