import type {
  IImageDerivedAttributeCalculator,
  ImageDerivedAttributeCalculationInput,
} from "@domain/dataset-studio/interfaces/IImageDerivedAttributeCalculator";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  ImageOrientationKinds,
  createImageDerivedAttributes,
  type ImageDerivedAttributesRecord,
} from "@domain/dataset-studio/contracts/ImageDerivedAttributes";

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function hasValidDimensions(input: ImageDerivedAttributeCalculationInput): input is Required<Pick<ImageDerivedAttributeCalculationInput, "width" | "height">> {
  return typeof input.width === "number"
    && Number.isFinite(input.width)
    && input.width > 0
    && typeof input.height === "number"
    && Number.isFinite(input.height)
    && input.height > 0;
}

export class DefaultImageDerivedAttributeCalculator implements IImageDerivedAttributeCalculator {
  public calculate(input: ImageDerivedAttributeCalculationInput): ImageDerivedAttributesRecord {
    const derived: Record<string, CanonicalRecordValue> = {};
    const format = normalizeOptional(input.format)?.toLowerCase();

    if (format === "gif") {
      derived.isAnimated = true;
    } else if (format) {
      derived.isAnimated = false;
    }

    if (!hasValidDimensions(input)) {
      return createImageDerivedAttributes(derived);
    }

    derived.aspectRatio = roundTo(input.width / input.height, 6);
    if (input.width > input.height) {
      derived.orientation = ImageOrientationKinds.landscape;
    } else if (input.width < input.height) {
      derived.orientation = ImageOrientationKinds.portrait;
    } else {
      derived.orientation = ImageOrientationKinds.square;
    }

    const pixelCount = Math.floor(input.width * input.height);
    derived.pixelCount = pixelCount;
    derived.megapixels = roundTo(pixelCount / 1_000_000, 4);

    return createImageDerivedAttributes(derived);
  }
}

