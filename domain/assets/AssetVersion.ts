import { AssetId } from "./AssetId";

function freezeRecord(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

export class AssetVersion {
  public readonly assetId: AssetId;
  public readonly versionId: string;
  public readonly createdAt: Date;
  public readonly createdBy?: string;
  public readonly contentSha256?: string;
  public readonly contentLengthBytes?: number;
  public readonly upstreamVersionIds: ReadonlyArray<string>;
  public readonly metadata?: Readonly<Record<string, unknown>>;
  public readonly reproducibilitySummary?: Readonly<Record<string, unknown>>;

  constructor(params: {
    assetId: string | AssetId;
    versionId: string;
    createdAt?: Date;
    createdBy?: string;
    contentSha256?: string;
    contentLengthBytes?: number;
    upstreamVersionIds?: ReadonlyArray<string>;
    metadata?: Readonly<Record<string, unknown>>;
    reproducibilitySummary?: Readonly<Record<string, unknown>>;
  }) {
    const versionId = params.versionId.trim();
    if (!versionId) {
      throw new Error("AssetVersion.versionId cannot be empty.");
    }

    const upstream = [...new Set((params.upstreamVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean))];
    if (upstream.includes(versionId)) {
      throw new Error("AssetVersion.upstreamVersionIds cannot include the version itself.");
    }

    const contentLengthBytes = params.contentLengthBytes;
    if (contentLengthBytes !== undefined && contentLengthBytes < 0) {
      throw new Error("AssetVersion.contentLengthBytes cannot be negative.");
    }

    this.assetId = AssetId.from(params.assetId);
    this.versionId = versionId;
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.createdBy = normalizeOptionalString(params.createdBy);
    this.contentSha256 = normalizeOptionalString(params.contentSha256)?.toLowerCase();
    this.contentLengthBytes = contentLengthBytes;
    this.upstreamVersionIds = Object.freeze(upstream);
    this.metadata = freezeRecord(params.metadata);
    this.reproducibilitySummary = freezeRecord(params.reproducibilitySummary);
  }
}
