const ASSET_LINEAGE_EDGE_KINDS = [
  "derived-from",
  "transformed-from",
  "trained-from",
  "generated-from",
  "version-of",
  "supersedes",
  "input-to-run",
  "output-of-run",
  "contains",
  "preview-of",
] as const;

export type AssetLineageEdgeKind = (typeof ASSET_LINEAGE_EDGE_KINDS)[number];

function isAssetLineageEdgeKind(value: string): value is AssetLineageEdgeKind {
  return (ASSET_LINEAGE_EDGE_KINDS as ReadonlyArray<string>).includes(value);
}

function freezeRecord(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

function normalizeId(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} cannot be empty.`);
  }

  return normalized;
}

function normalizeKind(value: string): AssetLineageEdgeKind {
  const normalized = value.trim().toLowerCase();
  if (!isAssetLineageEdgeKind(normalized)) {
    throw new Error(`AssetLineageEdge.kind '${value}' is not supported.`);
  }

  return normalized;
}

export class AssetLineageEdge {
  public readonly edgeId: string;
  public readonly fromVersionId: string;
  public readonly toVersionId: string;
  public readonly kind: AssetLineageEdgeKind;
  public readonly transformationId?: string;
  public readonly createdAt: Date;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    edgeId: string;
    fromVersionId: string;
    toVersionId: string;
    kind: AssetLineageEdgeKind | string;
    transformationId?: string;
    createdAt?: Date;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.edgeId = normalizeId("AssetLineageEdge.edgeId", params.edgeId);
    this.fromVersionId = normalizeId("AssetLineageEdge.fromVersionId", params.fromVersionId);
    this.toVersionId = normalizeId("AssetLineageEdge.toVersionId", params.toVersionId);
    if (this.fromVersionId === this.toVersionId) {
      throw new Error("AssetLineageEdge requires distinct fromVersionId and toVersionId.");
    }

    this.kind = normalizeKind(params.kind);
    this.transformationId = params.transformationId?.trim() || undefined;
    this.createdAt = params.createdAt ? new Date(params.createdAt.getTime()) : new Date();
    this.metadata = freezeRecord(params.metadata);
  }
}
