import type { ImageAsset } from "../../../contracts/image";

export interface ImageAssetDescriptorListQuery {
  readonly searchText?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ImageAssetDescriptorListResult {
  readonly items: readonly ImageAsset[];
  readonly nextCursor?: string;
}

/**
 * Descriptor-only read seam for already-finalized image assets.
 *
 * Implementations must return tracked metadata records only. They must not scan
 * storage, resolve filesystem paths, read image bytes, or derive previews.
 */
export interface ImageAssetDescriptorReadPort {
  listImageAssetDescriptors(query?: ImageAssetDescriptorListQuery): Promise<ImageAssetDescriptorListResult>;
  readImageAssetDescriptor?(assetId: string): Promise<ImageAsset | null | undefined>;
}
