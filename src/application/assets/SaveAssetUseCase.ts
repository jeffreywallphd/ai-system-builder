import type { IAsset } from "@domain/assets/interfaces/IAsset";
import { Asset } from "@domain/assets/Asset";
import { AssetAuditInfo, AssetLocation } from "@domain/assets/AssetMetadata";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";

export interface ISaveAssetRequest {
  readonly asset: IAsset;
  readonly content?: Uint8Array | string;
  readonly destination?: string;
  readonly createDirectories?: boolean;
  readonly overwrite?: boolean;
  readonly persistContent?: boolean;
}

export interface ISaveAssetResult {
  readonly asset: IAsset;
  readonly created: boolean;
  readonly contentPersisted: boolean;
}

export class SaveAssetUseCase {
  private readonly assetCatalog: IAssetCatalog;
  private readonly fileStorage: IFileStorage;

  constructor(params: { assetCatalog: IAssetCatalog; fileStorage: IFileStorage }) {
    this.assetCatalog = params.assetCatalog;
    this.fileStorage = params.fileStorage;
  }

  public async execute(request: ISaveAssetRequest): Promise<ISaveAssetResult> {
    const existing = await this.assetCatalog.getById(request.asset.id);
    const created = !existing;

    let asset = Asset.from(request.asset);
    const persistContent = request.persistContent ?? request.content !== undefined;

    if (persistContent) {
      const destination = this.resolveDestination(request);

      if (!request.overwrite && (await this.fileStorage.exists(destination))) {
        throw new Error(`Asset destination '${destination}' already exists.`);
      }

      await this.fileStorage.write({
        path: destination,
        content: request.content ?? "",
        createDirectories: request.createDirectories ?? true,
        overwrite: request.overwrite ?? false,
      });

      const stat = await this.fileStorage.stat(destination);

      asset = new Asset({
        id: asset.id,
        name: asset.name,
        version: asset.version,
        kind: asset.kind,
        status: "available",
        source: asset.source,
        location: new AssetLocation({
          accessMethod: "local-file",
          location: destination,
          format: asset.location.format,
          contentType: asset.location.contentType,
        }),
        technicalMetadata: {
          ...asset.technicalMetadata,
          sizeBytes: stat.sizeBytes ?? asset.technicalMetadata?.sizeBytes,
        },
        semanticMetadata: asset.semanticMetadata,
        relationships: asset.relationships,
        audit: new AssetAuditInfo({
          createdAt: asset.audit?.createdAt,
          updatedAt: new Date(),
        }),
      });
    } else {
      asset = new Asset({
        id: asset.id,
        name: asset.name,
        version: asset.version,
        kind: asset.kind,
        status: asset.status,
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
    }

    await this.assetCatalog.save(asset);

    return Object.freeze({
      asset,
      created,
      contentPersisted: persistContent,
    });
  }

  private resolveDestination(request: ISaveAssetRequest): string {
    const destination = request.destination?.trim() || request.asset.location.location?.trim();

    if (!destination) {
      throw new Error(
        `SaveAssetUseCase requires a destination path for asset '${request.asset.id}'.`
      );
    }

    return destination;
  }
}

