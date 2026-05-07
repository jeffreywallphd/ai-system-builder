import type { AssetMetadata } from "./asset-metadata";
import type { AssetReference } from "./asset-reference";
import type { AssetGeneratedOutputReference } from "./asset-generated-output-reference";
import type { AssetResourceBacking } from "./asset-resource-backing";

export interface AssetResourceBackedAsset {
  readonly assetRef: AssetReference;
  readonly backings: readonly AssetResourceBacking[];
  readonly primaryBackingRef?: AssetReference;
  readonly previewRefs?: readonly AssetReference[];
  readonly generatedFrom?: AssetGeneratedOutputReference;
  readonly metadata?: AssetMetadata;
}
