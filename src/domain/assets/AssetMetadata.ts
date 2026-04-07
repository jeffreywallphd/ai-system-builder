import type {
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "../../../domain/assets/interfaces/IAsset";
import type { RuntimeEngine } from "../models/interfaces/IModelCompatibility";

function freezeArray<T>(values?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  return values ? Object.freeze([...values]) : undefined;
}

function freezeRecord<T extends Record<string, unknown>>(
  value?: T
): Readonly<T> | undefined {
  return value ? Object.freeze({ ...value }) : undefined;
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

export class AssetLocation implements IAssetLocation {
  public readonly accessMethod: IAssetLocation["accessMethod"];
  public readonly location?: string;
  public readonly format?: string;
  public readonly contentType?: string;

  constructor(params: {
    accessMethod: IAssetLocation["accessMethod"];
    location?: string;
    format?: string;
    contentType?: string;
  }) {
    this.accessMethod = params.accessMethod;
    this.location = normalizeOptionalString(params.location);
    this.format = normalizeOptionalString(params.format)?.toLowerCase();
    this.contentType = normalizeOptionalString(params.contentType)?.toLowerCase();

    if (
      (this.accessMethod === "local-file" ||
        this.accessMethod === "local-directory" ||
        this.accessMethod === "remote-url") &&
      !this.location
    ) {
      throw new Error(
        `AssetLocation.location is required for accessMethod '${this.accessMethod}'.`
      );
    }
  }

  public hasLocation(): boolean {
    return !!this.location;
  }

  public hasFormat(format: string): boolean {
    return !!this.format && this.format === format.trim().toLowerCase();
  }

  public static from(location: IAssetLocation): AssetLocation {
    return new AssetLocation({
      accessMethod: location.accessMethod,
      location: location.location,
      format: location.format,
      contentType: location.contentType,
    });
  }
}

export class AssetSourceInfo implements IAssetSourceInfo {
  public readonly type: IAssetSourceInfo["type"];
  public readonly workflowId?: string;
  public readonly nodeId?: string;
  public readonly executionId?: string;
  public readonly parentAssetId?: string;
  public readonly runtime?: RuntimeEngine;
  public readonly provider?: string;

  constructor(params: {
    type: IAssetSourceInfo["type"];
    workflowId?: string;
    nodeId?: string;
    executionId?: string;
    parentAssetId?: string;
    runtime?: RuntimeEngine;
    provider?: string;
  }) {
    this.type = params.type;
    this.workflowId = normalizeOptionalString(params.workflowId);
    this.nodeId = normalizeOptionalString(params.nodeId);
    this.executionId = normalizeOptionalString(params.executionId);
    this.parentAssetId = normalizeOptionalString(params.parentAssetId);
    this.runtime = params.runtime;
    this.provider = normalizeOptionalString(params.provider);

    if (this.type === "derived" && !this.parentAssetId) {
      throw new Error(
        "AssetSourceInfo.parentAssetId is required when source type is 'derived'."
      );
    }
  }

  public belongsToWorkflow(workflowId: string): boolean {
    return !!this.workflowId && this.workflowId === workflowId.trim();
  }

  public belongsToNode(nodeId: string): boolean {
    return !!this.nodeId && this.nodeId === nodeId.trim();
  }

  public hasParent(): boolean {
    return !!this.parentAssetId;
  }

  public static from(source: IAssetSourceInfo): AssetSourceInfo {
    return new AssetSourceInfo({
      type: source.type,
      workflowId: source.workflowId,
      nodeId: source.nodeId,
      executionId: source.executionId,
      parentAssetId: source.parentAssetId,
      runtime: source.runtime,
      provider: source.provider,
    });
  }
}

export class AssetTechnicalMetadata implements IAssetTechnicalMetadata {
  public readonly sizeBytes?: number;
  public readonly sha256?: string;
  public readonly width?: number;
  public readonly height?: number;
  public readonly durationMs?: number;
  public readonly sampleRateHz?: number;
  public readonly channels?: number;
  public readonly frameRate?: number;
  public readonly tokenCount?: number;
  public readonly itemCount?: number;

  constructor(params: Partial<IAssetTechnicalMetadata> = {}) {
    this.sizeBytes = params.sizeBytes;
    this.sha256 = normalizeOptionalString(params.sha256)?.toLowerCase();
    this.width = params.width;
    this.height = params.height;
    this.durationMs = params.durationMs;
    this.sampleRateHz = params.sampleRateHz;
    this.channels = params.channels;
    this.frameRate = params.frameRate;
    this.tokenCount = params.tokenCount;
    this.itemCount = params.itemCount;

    this.validateNonNegative("sizeBytes", this.sizeBytes);
    this.validateNonNegative("width", this.width);
    this.validateNonNegative("height", this.height);
    this.validateNonNegative("durationMs", this.durationMs);
    this.validateNonNegative("sampleRateHz", this.sampleRateHz);
    this.validateNonNegative("channels", this.channels);
    this.validateNonNegative("frameRate", this.frameRate);
    this.validateNonNegative("tokenCount", this.tokenCount);
    this.validateNonNegative("itemCount", this.itemCount);
  }

  public hasVisualDimensions(): boolean {
    return this.width !== undefined && this.height !== undefined;
  }

  public hasDuration(): boolean {
    return this.durationMs !== undefined;
  }

  public hasAudioProfile(): boolean {
    return this.sampleRateHz !== undefined || this.channels !== undefined;
  }

  public static from(
    metadata?: IAssetTechnicalMetadata
  ): AssetTechnicalMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    return new AssetTechnicalMetadata(metadata);
  }

  private validateNonNegative(name: string, value?: number): void {
    if (value !== undefined && value < 0) {
      throw new Error(`AssetTechnicalMetadata.${name} cannot be negative.`);
    }
  }
}

export class AssetSemanticMetadata implements IAssetSemanticMetadata {
  public readonly description?: string;
  public readonly tags?: ReadonlyArray<string>;
  public readonly languageCodes?: ReadonlyArray<string>;
  public readonly attributes?: Readonly<
    Record<string, string | number | boolean | null>
  >;

  constructor(params: {
    description?: string;
    tags?: ReadonlyArray<string>;
    languageCodes?: ReadonlyArray<string>;
    attributes?: Readonly<Record<string, string | number | boolean | null>>;
  } = {}) {
    this.description = normalizeOptionalString(params.description);
    this.tags = freezeArray(
      params.tags?.map((tag) => tag.trim()).filter(Boolean)
    );
    this.languageCodes = freezeArray(
      params.languageCodes?.map((code) => code.trim().toLowerCase()).filter(Boolean)
    );
    this.attributes = freezeRecord(params.attributes);
  }

  public hasTag(tag: string): boolean {
    const normalized = tag.trim();
    return !!normalized && !!this.tags?.includes(normalized);
  }

  public getAttribute(
    key: string
  ): string | number | boolean | null | undefined {
    return this.attributes?.[key];
  }

  public static from(
    metadata?: IAssetSemanticMetadata
  ): AssetSemanticMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    return new AssetSemanticMetadata({
      description: metadata.description,
      tags: metadata.tags,
      languageCodes: metadata.languageCodes,
      attributes: metadata.attributes,
    });
  }
}

export class AssetAuditInfo implements IAssetAuditInfo {
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(params: {
    createdAt?: Date;
    updatedAt?: Date;
  } = {}) {
    this.createdAt = cloneDate(params.createdAt);
    this.updatedAt = cloneDate(params.updatedAt);

    if (
      this.createdAt &&
      this.updatedAt &&
      this.updatedAt.getTime() < this.createdAt.getTime()
    ) {
      throw new Error(
        "AssetAuditInfo.updatedAt cannot be earlier than createdAt."
      );
    }
  }

  public touch(now: Date = new Date()): AssetAuditInfo {
    return new AssetAuditInfo({
      createdAt: this.createdAt ?? now,
      updatedAt: now,
    });
  }

  public static from(audit?: IAssetAuditInfo): AssetAuditInfo | undefined {
    if (!audit) {
      return undefined;
    }

    return new AssetAuditInfo({
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
    });
  }
}

export class AssetRelationship implements IAssetRelationship {
  public readonly assetId: string;
  public readonly kind: string;

  constructor(params: { assetId: string; kind: string }) {
    const assetId = params.assetId.trim();
    const kind = params.kind.trim().toLowerCase();

    if (!assetId) {
      throw new Error("AssetRelationship.assetId cannot be empty.");
    }

    if (!kind) {
      throw new Error("AssetRelationship.kind cannot be empty.");
    }

    this.assetId = assetId;
    this.kind = kind;
  }

  public matches(assetId: string, kind?: string): boolean {
    if (this.assetId !== assetId.trim()) {
      return false;
    }

    if (!kind) {
      return true;
    }

    return this.kind === kind.trim().toLowerCase();
  }

  public static from(relationship: IAssetRelationship): AssetRelationship {
    return new AssetRelationship({
      assetId: relationship.assetId,
      kind: relationship.kind,
    });
  }
}
