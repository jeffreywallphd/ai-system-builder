export const ImageTransformationTargetFormats = Object.freeze({
  keep: "keep",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "avif",
} as const);

export type ImageTransformationTargetFormat =
  typeof ImageTransformationTargetFormats[keyof typeof ImageTransformationTargetFormats];

export interface ImageTransformationOptions {
  readonly resizeWidth?: number;
  readonly resizeHeight?: number;
  readonly grayscale?: boolean;
  readonly targetFormat?: ImageTransformationTargetFormat;
}

export interface ImageTransformationResult {
  readonly payload: Uint8Array;
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly transformed: boolean;
}

export interface IImageTransformer {
  transform(payload: Uint8Array, options?: ImageTransformationOptions): Promise<ImageTransformationResult>;
}
