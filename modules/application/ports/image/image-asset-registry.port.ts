import type { ImageAsset } from "../../../contracts/image";

export interface RegisterImageAssetInput {
  artifactId: string;
  source: "generated" | "uploaded";
  metadata?: {
    prompt?: string;
    negativePrompt?: string;
    seed?: number;
    model?: string;
    engine?: string;
    workflowTemplateId?: string;
    width?: number;
    height?: number;
    createdAt?: number;
  };
}

export interface ImageAssetRegistryPort {
  registerImageAsset(input: RegisterImageAssetInput): Promise<{ assetId: string }>;
  getImageAsset(assetId: string): Promise<ImageAsset | null>;
}
