export interface ImageAssetMetadata {
  requestId?: string;
  originalFileName?: string;
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  model?: string;
  engine?: string;
  workflowTemplateId?: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface ImageAsset {
  assetId: string;
  artifactId: string;
  source: "uploaded" | "generated";
  metadata: ImageAssetMetadata;
}
