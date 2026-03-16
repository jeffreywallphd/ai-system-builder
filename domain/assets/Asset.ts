import type {
  AssetKind,
  AssetLifecycleStatus,
  IAsset,
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "./interfaces/IAsset";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "./AssetMetadata";

function normalize(value: string): string {
  return value.trim();
}

function freezeRelationships(
  relationships?: ReadonlyArray<IAssetRelationship>
): ReadonlyArray<IAssetRelationship> {
  const normalized = (relationships ?? []).map((relationship) =>
    AssetRelationship.from(relationship)
  );

  const unique = new Map<string, IAssetRelationship>();
  for (const relationship of normalized) {
    unique.set(`${relationship.kind}:${relationship.assetId}`, relationship);
  }

  return Object.freeze([...unique.values()]);
}

export class Asset implements IAsset {
  public readonly id: string;
  public readonly name: string;
  public readonly version?: string;
  public readonly kind: AssetKind;
  public readonly status: AssetLifecycleStatus;
  public readonly source: IAssetSourceInfo;
  public readonly location: IAssetLocation;
  public readonly technicalMetadata?: IAssetTechnicalMetadata;
  public readonly semanticMetadata?: IAssetSemanticMetadata;
  public readonly relationships: ReadonlyArray<IAssetRelationship>;
  public readonly audit?: IAssetAuditInfo;

  constructor(params: {
    id: string;
    name: string;
    version?: string;
    kind: AssetKind;
    status?: AssetLifecycleStatus;
    source: IAssetSourceInfo;
    location: IAssetLocation;
    technicalMetadata?: IAssetTechnicalMetadata;
    semanticMetadata?: IAssetSemanticMetadata;
    relationships?: ReadonlyArray<IAssetRelationship>;
    audit?: IAssetAuditInfo;
  }) {
    const id = normalize(params.id);
    const name = normalize(params.name);

    if (!id) {
      throw new Error("Asset.id cannot be empty.");
    }

    if (!name) {
      throw new Error("Asset.name cannot be empty.");
    }

    this.id = id;
    this.name = name;
    this.version = params.version?.trim() || undefined;
    this.kind = params.kind;
    this.status = params.status ?? "draft";
    this.source = AssetSourceInfo.from(params.source);
    this.location = AssetLocation.from(params.location);
    this.technicalMetadata = AssetTechnicalMetadata.from(
      params.technicalMetadata
    );
    this.semanticMetadata = AssetSemanticMetadata.from(
      params.semanticMetadata
    );
    this.relationships = freezeRelationships(params.relationships);
    this.audit = AssetAuditInfo.from(params.audit);

    if (this.status === "available" && !this.location.hasLocation()) {
      throw new Error(
        "Available assets must have a concrete location or reference."
      );
    }
  }

  public isAvailable(): boolean {
    return this.status === "available";
  }

  public isGenerated(): boolean {
    return this.source.type === "generated";
  }

  public isDerived(): boolean {
    return this.source.type === "derived" || !!this.source.parentAssetId;
  }

  public belongsToWorkflow(workflowId: string): boolean {
    return this.source.belongsToWorkflow(workflowId);
  }

  public belongsToNode(nodeId: string): boolean {
    return this.source.belongsToNode(nodeId);
  }

  public isRelatedTo(assetId: string): boolean {
    const normalizedAssetId = assetId.trim();
    return this.relationships.some(
      (relationship) => relationship.assetId === normalizedAssetId
    );
  }

  public isKind(kind: AssetKind): boolean {
    return this.kind === kind;
  }

  public toReferenceString(): string {
    return this.version ? `${this.name}@${this.version}` : this.name;
  }

  public withStatus(status: AssetLifecycleStatus): Asset {
    return new Asset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      status,
      source: this.source,
      location: this.location,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata: this.semanticMetadata,
      relationships: this.relationships,
      audit: this.touchAudit(),
    });
  }

  public withLocation(location: IAssetLocation): Asset {
    return new Asset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      status: this.status,
      source: this.source,
      location,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata: this.semanticMetadata,
      relationships: this.relationships,
      audit: this.touchAudit(),
    });
  }

  public withRelationship(relationship: IAssetRelationship): Asset {
    return new Asset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      status: this.status,
      source: this.source,
      location: this.location,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata: this.semanticMetadata,
      relationships: [...this.relationships, relationship],
      audit: this.touchAudit(),
    });
  }

  public withSemanticMetadata(
    semanticMetadata: IAssetSemanticMetadata | undefined
  ): Asset {
    return new Asset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      status: this.status,
      source: this.source,
      location: this.location,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata,
      relationships: this.relationships,
      audit: this.touchAudit(),
    });
  }

  public static from(asset: IAsset): Asset {
    return new Asset({
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
      audit: asset.audit,
    });
  }

  protected touchAudit(): IAssetAuditInfo | undefined {
    const currentAudit = AssetAuditInfo.from(this.audit);
    return (currentAudit ?? new AssetAuditInfo()).touch();
  }
}
