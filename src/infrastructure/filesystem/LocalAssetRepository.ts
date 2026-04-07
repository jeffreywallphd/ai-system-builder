import path from "node:path";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import { Asset } from "../../domain/assets/Asset";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../../domain/assets/AssetMetadata";
import type {
  IAssetCatalog,
  IAssetSearchCriteria,
} from "../../application/ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";

interface AssetRecord {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly kind: IAsset["kind"];
  readonly status: IAsset["status"];
  readonly source: {
    readonly type: IAsset["source"]["type"];
    readonly workflowId?: string;
    readonly nodeId?: string;
    readonly executionId?: string;
    readonly parentAssetId?: string;
    readonly runtime?: string;
    readonly provider?: string;
  };
  readonly location: {
    readonly accessMethod: IAsset["location"]["accessMethod"];
    readonly location?: string;
    readonly format?: string;
    readonly contentType?: string;
  };
  readonly technicalMetadata?: {
    readonly sizeBytes?: number;
    readonly sha256?: string;
    readonly width?: number;
    readonly height?: number;
    readonly durationMs?: number;
    readonly sampleRateHz?: number;
    readonly channels?: number;
    readonly frameRate?: number;
    readonly tokenCount?: number;
    readonly itemCount?: number;
  };
  readonly semanticMetadata?: {
    readonly description?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly languageCodes?: ReadonlyArray<string>;
    readonly attributes?: Readonly<Record<string, string | number | boolean | null>>;
  };
  readonly relationships: ReadonlyArray<{
    readonly assetId: string;
    readonly kind: string;
  }>;
  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function assetMatchesCriteria(asset: IAsset, criteria?: IAssetSearchCriteria): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      asset.id,
      asset.name,
      asset.kind,
      asset.status,
      asset.version,
      asset.location.location,
      asset.location.format,
      asset.location.contentType,
      asset.source.type,
      asset.source.provider,
      asset.semanticMetadata?.description,
      ...(asset.semanticMetadata?.tags ?? []),
      ...(asset.semanticMetadata?.languageCodes ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  if (criteria.ids && criteria.ids.length > 0 && !criteria.ids.includes(asset.id)) {
    return false;
  }

  if (criteria.kinds && criteria.kinds.length > 0 && !criteria.kinds.includes(asset.kind)) {
    return false;
  }

  if (
    criteria.statuses &&
    criteria.statuses.length > 0 &&
    !criteria.statuses.includes(asset.status)
  ) {
    return false;
  }

  if (criteria.workflowId && !asset.belongsToWorkflow(criteria.workflowId)) {
    return false;
  }

  if (criteria.nodeId && !asset.belongsToNode(criteria.nodeId)) {
    return false;
  }

  if (
    criteria.executionId &&
    asset.source.executionId !== criteria.executionId.trim()
  ) {
    return false;
  }

  if (
    criteria.parentAssetId &&
    asset.source.parentAssetId !== criteria.parentAssetId.trim()
  ) {
    return false;
  }

  if (
    criteria.sourceTypes &&
    criteria.sourceTypes.length > 0 &&
    !criteria.sourceTypes.includes(asset.source.type)
  ) {
    return false;
  }

  if (
    criteria.tags &&
    criteria.tags.length > 0 &&
    !criteria.tags.some((tag) => asset.semanticMetadata?.tags?.includes(tag))
  ) {
    return false;
  }

  if (
    criteria.languageCodes &&
    criteria.languageCodes.length > 0 &&
    !criteria.languageCodes.some((code) =>
      asset.semanticMetadata?.languageCodes?.includes(code)
    )
  ) {
    return false;
  }

  return true;
}

export class LocalAssetRepository implements IAssetCatalog {
  private readonly fileStorage: IFileStorage;
  private readonly rootDirectory: string;
  private readonly indexPath: string;

  constructor(params: {
    fileStorage: IFileStorage;
    rootDirectory: string;
    indexFileName?: string;
  }) {
    this.fileStorage = params.fileStorage;
    this.rootDirectory = params.rootDirectory.trim();
    this.indexPath = path.join(
      this.rootDirectory,
      params.indexFileName?.trim() || "assets.index.json"
    );
  }

  public async list(criteria?: IAssetSearchCriteria): Promise<ReadonlyArray<IAsset>> {
    const records = await this.readIndex();
    const assets = records.map((record) => this.toDomain(record));
    const filtered = assets.filter((asset) => assetMatchesCriteria(asset, criteria));

    const limited =
      criteria?.limit && criteria.limit > 0
        ? filtered.slice(0, criteria.limit)
        : filtered;

    return Object.freeze(
      limited.sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  public async getById(id: string): Promise<IAsset | undefined> {
    const normalizedId = id.trim();
    const records = await this.readIndex();
    const record = records.find((item) => item.id === normalizedId);
    return record ? this.toDomain(record) : undefined;
  }

  public async save(asset: IAsset): Promise<void> {
    const records = await this.readIndex();
    const record = this.toRecord(asset);
    const existingIndex = records.findIndex((item) => item.id === asset.id);

    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }

    await this.writeIndex(records);
  }

  public async remove(id: string): Promise<boolean> {
    const normalizedId = id.trim();
    const records = await this.readIndex();
    const filtered = records.filter((item) => item.id !== normalizedId);

    if (filtered.length === records.length) {
      return false;
    }

    await this.writeIndex(filtered);
    return true;
  }

  public async exists(id: string): Promise<boolean> {
    return !!(await this.getById(id));
  }

  private async readIndex(): Promise<AssetRecord[]> {
    if (!(await this.fileStorage.exists(this.indexPath))) {
      return [];
    }

    const content = await this.fileStorage.readText(this.indexPath, "utf-8");
    const parsed = JSON.parse(content) as ReadonlyArray<AssetRecord>;
    return [...parsed];
  }

  private async writeIndex(records: ReadonlyArray<AssetRecord>): Promise<void> {
    await this.fileStorage.write({
      path: this.indexPath,
      content: JSON.stringify(records, null, 2),
      createDirectories: true,
      overwrite: true,
    });
  }

  private toRecord(asset: IAsset): AssetRecord {
    return {
      id: asset.id,
      name: asset.name,
      version: asset.version,
      kind: asset.kind,
      status: asset.status,
      source: {
        type: asset.source.type,
        workflowId: asset.source.workflowId,
        nodeId: asset.source.nodeId,
        executionId: asset.source.executionId,
        parentAssetId: asset.source.parentAssetId,
        runtime: asset.source.runtime,
        provider: asset.source.provider,
      },
      location: {
        accessMethod: asset.location.accessMethod,
        location: asset.location.location,
        format: asset.location.format,
        contentType: asset.location.contentType,
      },
      technicalMetadata: asset.technicalMetadata
        ? {
            sizeBytes: asset.technicalMetadata.sizeBytes,
            sha256: asset.technicalMetadata.sha256,
            width: asset.technicalMetadata.width,
            height: asset.technicalMetadata.height,
            durationMs: asset.technicalMetadata.durationMs,
            sampleRateHz: asset.technicalMetadata.sampleRateHz,
            channels: asset.technicalMetadata.channels,
            frameRate: asset.technicalMetadata.frameRate,
            tokenCount: asset.technicalMetadata.tokenCount,
            itemCount: asset.technicalMetadata.itemCount,
          }
        : undefined,
      semanticMetadata: asset.semanticMetadata
        ? {
            description: asset.semanticMetadata.description,
            tags: asset.semanticMetadata.tags,
            languageCodes: asset.semanticMetadata.languageCodes,
            attributes: asset.semanticMetadata.attributes,
          }
        : undefined,
      relationships: asset.relationships.map((relationship) => ({
        assetId: relationship.assetId,
        kind: relationship.kind,
      })),
      audit: asset.audit
        ? {
            createdAt: asset.audit.createdAt?.toISOString(),
            updatedAt: asset.audit.updatedAt?.toISOString(),
          }
        : undefined,
    };
  }

  private toDomain(record: AssetRecord): IAsset {
    return new Asset({
      id: record.id,
      name: record.name,
      version: record.version,
      kind: record.kind,
      status: record.status,
      source: new AssetSourceInfo({
        type: record.source.type,
        workflowId: record.source.workflowId,
        nodeId: record.source.nodeId,
        executionId: record.source.executionId,
        parentAssetId: record.source.parentAssetId,
        runtime: record.source.runtime as IAsset["source"]["runtime"],
        provider: record.source.provider,
      }),
      location: new AssetLocation({
        accessMethod: record.location.accessMethod,
        location: record.location.location,
        format: record.location.format,
        contentType: record.location.contentType,
      }),
      technicalMetadata: record.technicalMetadata
        ? new AssetTechnicalMetadata(record.technicalMetadata)
        : undefined,
      semanticMetadata: record.semanticMetadata
        ? new AssetSemanticMetadata(record.semanticMetadata)
        : undefined,
      relationships: record.relationships.map(
        (relationship) => new AssetRelationship(relationship)
      ),
      audit: record.audit
        ? new AssetAuditInfo({
            createdAt: record.audit.createdAt
              ? new Date(record.audit.createdAt)
              : undefined,
            updatedAt: record.audit.updatedAt
              ? new Date(record.audit.updatedAt)
              : undefined,
          })
        : undefined,
    });
  }
}
