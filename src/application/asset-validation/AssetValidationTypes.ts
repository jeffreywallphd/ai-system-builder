import type { AssetValidationResult } from "@domain/contracts/AssetValidation";

export const ValidatedAssetTypes = Object.freeze({
  template: "template",
  workflow: "workflow",
  dataset: "dataset",
  system: "system",
} as const);

export type ValidatedAssetType = typeof ValidatedAssetTypes[keyof typeof ValidatedAssetTypes];

export interface ValidatedAssetRef {
  readonly assetType: ValidatedAssetType;
  readonly assetId: string;
  readonly versionId?: string;
  readonly payload?: unknown;
}

export interface AssetValidator {
  readonly assetType: ValidatedAssetType;
  validate(asset: ValidatedAssetRef): Promise<AssetValidationResult>;
}

