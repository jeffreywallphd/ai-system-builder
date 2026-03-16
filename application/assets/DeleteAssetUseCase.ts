import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import { Asset } from "../../domain/assets/Asset";
import { AssetAuditInfo } from "../../domain/assets/AssetMetadata";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";

export interface IDeleteAssetRequest {
  readonly assetId: string;
  readonly deleteContent?: boolean;
  readonly hardDelete?: boolean;
  readonly ignoreMissingContent?: boolean;
}

export interface IDeleteAssetResult {
  readonly removed: boolean;
  readonly deletedContent: boolean;
  readonly asset?: IAsset;
}

export class DeleteAssetUseCase {
  private readonly assetCatalog: IAssetCatalog;
  private readonly fileStorage: IFileStorage;

  constructor(params: { assetCatalog: IAssetCatalog; fileStorage: IFileStorage }) {
    this.assetCatalog = params.assetCatalog;
    this.fileStorage = params.fileStorage;
  }

  public async execute(request: IDeleteAssetRequest): Promise<IDeleteAssetResult> {
    const assetId = request.assetId.trim();

    if (!assetId) {
      throw new Error("DeleteAssetUseCase requires a non-empty assetId.");
    }

    const asset = await this.assetCatalog.getById(assetId);

    if (!asset) {
      return Object.freeze({
        removed: false,
        deletedContent: false,
      });
    }

    let deletedContent = false;

    if (request.deleteContent) {
      const location = asset.location.location;

      if (location) {
        const exists = await this.fileStorage.exists(location);

        if (exists) {
          await this.fileStorage.delete(location);
          deletedContent = true;
        } else if (!request.ignoreMissingContent) {
          throw new Error(`Asset content for '${assetId}' does not exist at '${location}'.`);
        }
      } else if (!request.ignoreMissingContent) {
        throw new Error(`Asset '${assetId}' does not have a deletable location.`);
      }
    }

    if (request.hardDelete) {
      const removed = await this.assetCatalog.remove(assetId);

      return Object.freeze({
        removed,
        deletedContent,
      });
    }

    const softDeletedAsset = new Asset({
      id: asset.id,
      name: asset.name,
      version: asset.version,
      kind: asset.kind,
      status: "deleted",
      source: asset.source,
      location: asset.location,
      technicalMetadata: asset.technicalMetadata,
      semanticMetadata: asset.semanticMetadata,
      relationships: asset.relationships,
      audit: new AssetAuditInfo({
        createdAt: asset.audit?.createdAt,
        updatedAt: new Date(),
      }),
    });

    await this.assetCatalog.save(softDeletedAsset);

    return Object.freeze({
      removed: true,
      deletedContent,
      asset: softDeletedAsset,
    });
  }
}
