import type { IAsset } from "@domain/assets/interfaces/IAsset";
import { Asset } from "@domain/assets/Asset";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetTechnicalMetadata,
} from "@domain/assets/AssetMetadata";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import { loadCanonicalAssetSummary, type CanonicalAssetSummary } from "./AssetLineageReadModelSupport";

export interface ILoadAssetRequest {
  readonly assetId: string;
  readonly loadContent?: boolean;
  readonly asText?: boolean;
  readonly encoding?: string;
  readonly refreshMetadata?: boolean;
}

export interface ILoadAssetResult {
  readonly asset: IAsset;
  readonly content?: Uint8Array | string;
  readonly canonicalSummary?: CanonicalAssetSummary;
}

export class LoadAssetUseCase {
  private readonly assetCatalog: IAssetCatalog;
  private readonly fileStorage: IFileStorage;
  private readonly versionRepository?: IAssetVersionRepository;
  private readonly lineageRepository?: IAssetLineageRepository;
  private readonly transformationRepository?: IAssetTransformationRepository;

  constructor(params: {
    assetCatalog: IAssetCatalog;
    fileStorage: IFileStorage;
    versionRepository?: IAssetVersionRepository;
    lineageRepository?: IAssetLineageRepository;
    transformationRepository?: IAssetTransformationRepository;
  }) {
    this.assetCatalog = params.assetCatalog;
    this.fileStorage = params.fileStorage;
    this.versionRepository = params.versionRepository;
    this.lineageRepository = params.lineageRepository;
    this.transformationRepository = params.transformationRepository;
  }

  public async execute(request: ILoadAssetRequest): Promise<ILoadAssetResult> {
    const assetId = request.assetId.trim();

    if (!assetId) {
      throw new Error("LoadAssetUseCase requires a non-empty assetId.");
    }

    const asset = await this.assetCatalog.getById(assetId);

    if (!asset) {
      throw new Error(`Asset '${assetId}' was not found.`);
    }

    const location = asset.location.location;
    const shouldTouchStorage =
      request.loadContent || request.refreshMetadata || asset.status === "missing";

    let effectiveAsset = Asset.from(asset);

    if (shouldTouchStorage && location) {
      const exists = await this.fileStorage.exists(location);

      if (!exists) {
        effectiveAsset = effectiveAsset.withStatus("missing");
        await this.assetCatalog.save(effectiveAsset);

        if (request.loadContent) {
          throw new Error(`Asset content for '${assetId}' is missing at '${location}'.`);
        }
      } else if (request.refreshMetadata) {
        const stat = await this.fileStorage.stat(location);

        effectiveAsset = new Asset({
          id: effectiveAsset.id,
          name: effectiveAsset.name,
          version: effectiveAsset.version,
          kind: effectiveAsset.kind,
          status: "available",
          source: effectiveAsset.source,
          location: new AssetLocation({
            accessMethod: effectiveAsset.location.accessMethod,
            location: effectiveAsset.location.location,
            format: effectiveAsset.location.format,
            contentType: effectiveAsset.location.contentType,
          }),
          technicalMetadata: new AssetTechnicalMetadata({
            ...effectiveAsset.technicalMetadata,
            sizeBytes: stat.sizeBytes ?? effectiveAsset.technicalMetadata?.sizeBytes,
          }),
          semanticMetadata: effectiveAsset.semanticMetadata,
          relationships: effectiveAsset.relationships,
          audit: new AssetAuditInfo({
            createdAt: effectiveAsset.audit?.createdAt,
            updatedAt: new Date(),
          }),
        });

        await this.assetCatalog.save(effectiveAsset);
      }
    }

    if (!request.loadContent) {
      return Object.freeze({
        asset: effectiveAsset,
        canonicalSummary: await loadCanonicalAssetSummary(effectiveAsset.id, this.readRepositories()),
      });
    }

    if (!location) {
      throw new Error(`Asset '${assetId}' does not have a readable location.`);
    }

    if (request.asText) {
      const content = await this.fileStorage.readText(location, request.encoding);

      return Object.freeze({
        asset: effectiveAsset,
        content,
        canonicalSummary: await loadCanonicalAssetSummary(effectiveAsset.id, this.readRepositories()),
      });
    }

    const content = await this.fileStorage.read(location);

    return Object.freeze({
      asset: effectiveAsset,
      content: content.content,
      canonicalSummary: await loadCanonicalAssetSummary(effectiveAsset.id, this.readRepositories()),
    });
  }

  private readRepositories(): {
    versionRepository: IAssetVersionRepository;
    lineageRepository: IAssetLineageRepository;
    transformationRepository: IAssetTransformationRepository;
  } | undefined {
    if (!this.versionRepository || !this.lineageRepository || !this.transformationRepository) {
      return undefined;
    }

    return {
      versionRepository: this.versionRepository,
      lineageRepository: this.lineageRepository,
      transformationRepository: this.transformationRepository,
    };
  }
}

