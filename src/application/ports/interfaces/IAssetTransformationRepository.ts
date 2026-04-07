import type { AssetTransformation } from "@domain/assets/AssetTransformation";

export interface IAssetTransformationRepository {
  saveTransformation(transformation: AssetTransformation): Promise<void>;
  getById(transformationId: string): Promise<AssetTransformation | undefined>;
  listByVersionId(versionId: string): Promise<ReadonlyArray<AssetTransformation>>;
}

