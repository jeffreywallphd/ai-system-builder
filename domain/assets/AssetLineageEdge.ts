export const AssetLineageRelationshipType = Object.freeze({
  DERIVED_FROM: "DERIVED_FROM",
  GENERATED_FROM: "GENERATED_FROM",
  TRAINED_FROM: "TRAINED_FROM",
  TRANSFORMED_FROM: "TRANSFORMED_FROM",
  VERSION_OF: "VERSION_OF",
  INPUT_TO: "INPUT_TO",
  OUTPUT_OF: "OUTPUT_OF",
} as const);

export type AssetLineageRelationshipType = (typeof AssetLineageRelationshipType)[keyof typeof AssetLineageRelationshipType];

const LEGACY_KIND_MAP: Readonly<Record<string, AssetLineageRelationshipType>> = Object.freeze({
  "derived-from": AssetLineageRelationshipType.DERIVED_FROM,
  "generated-from": AssetLineageRelationshipType.GENERATED_FROM,
  "trained-from": AssetLineageRelationshipType.TRAINED_FROM,
  "transformed-from": AssetLineageRelationshipType.TRANSFORMED_FROM,
  "version-of": AssetLineageRelationshipType.VERSION_OF,
  "input-to-run": AssetLineageRelationshipType.INPUT_TO,
  "output-of-run": AssetLineageRelationshipType.OUTPUT_OF,
});

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

function normalizeType(value: string): AssetLineageRelationshipType {
  const normalized = value.trim();
  const typed = normalized in AssetLineageRelationshipType
    ? normalized as AssetLineageRelationshipType
    : LEGACY_KIND_MAP[normalized.toLowerCase()];
  if (!typed) {
    throw new Error(`AssetLineageEdge.kind '${value}' is not supported.`);
  }

  return typed;
}

export class AssetLineageEdge {
  public readonly edgeId: string;
  public readonly fromVersionId: string;
  public readonly toVersionId: string;
  public readonly type: AssetLineageRelationshipType;
  public readonly transformationId?: string;
  public readonly createdAt: Date;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    edgeId: string;
    fromVersionId: string;
    toVersionId: string;
    type?: AssetLineageRelationshipType | string;
    kind?: AssetLineageRelationshipType | string;
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

    this.type = normalizeType(params.type ?? params.kind ?? "");
    this.transformationId = params.transformationId?.trim() || undefined;
    this.createdAt = params.createdAt ? new Date(params.createdAt.getTime()) : new Date();
    this.metadata = freezeRecord(params.metadata);
  }

  public get kind(): AssetLineageRelationshipType {
    return this.type;
  }
}
