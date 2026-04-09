import type { GeneratedResultPreviewKind } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";

export interface GeneratedResultPreviewImageProfile {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly mediaType: "image/webp";
  readonly quality: number;
}

export interface GenerateResultPreviewDerivativeRequest {
  readonly sourceContent: Uint8Array;
  readonly sourceMediaType: string;
  readonly previewKind: GeneratedResultPreviewKind;
  readonly profile: GeneratedResultPreviewImageProfile;
}

export interface GenerateResultPreviewDerivativeResult {
  readonly content: Uint8Array;
  readonly mediaType: "image/webp";
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export interface IGeneratedResultPreviewImageProcessorPort {
  generatePreviewDerivative(
    request: GenerateResultPreviewDerivativeRequest,
  ): Promise<GenerateResultPreviewDerivativeResult>;
}

export interface CreateGeneratedResultPreviewAccessDescriptorRequest {
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly derivativeId: string;
  readonly previewKind: GeneratedResultPreviewKind;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly occurredAt: string;
}

export interface CreateGeneratedResultPreviewAccessDescriptorResult {
  readonly protectedResourceId: string;
  readonly accessHandle: string;
}

export interface IGeneratedResultPreviewAccessPort {
  createPreviewAccessDescriptor(
    request: CreateGeneratedResultPreviewAccessDescriptorRequest,
  ): CreateGeneratedResultPreviewAccessDescriptorResult;
}
