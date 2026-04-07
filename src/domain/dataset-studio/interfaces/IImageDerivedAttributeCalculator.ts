import type { CanonicalRecordValue } from "../CanonicalDataShapes";
import type { ImageDerivedAttributesRecord } from "../contracts/ImageDerivedAttributes";

export interface ImageDerivedAttributeCalculationInput {
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly tags?: ReadonlyArray<string>;
}

export interface IImageDerivedAttributeCalculator {
  calculate(input: ImageDerivedAttributeCalculationInput): ImageDerivedAttributesRecord;
}
