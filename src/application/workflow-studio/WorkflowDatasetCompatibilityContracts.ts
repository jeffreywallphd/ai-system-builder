import {
  ImageRecordContractIdentifier,
  ImageRecordSchemaVersions,
} from "@domain/dataset-studio/contracts/ImageRecordVersioning";

export const WorkflowDatasetCompatibilityKinds = Object.freeze({
  datasetReference: "dataset-reference",
  mediaImageRecords: "media-image-records",
} as const);

export type WorkflowDatasetCompatibilityKind =
  typeof WorkflowDatasetCompatibilityKinds[keyof typeof WorkflowDatasetCompatibilityKinds];

export const WorkflowMediaImageStableFieldKeys = Object.freeze([
  "assetRef",
  "width",
  "height",
  "format",
  "metadata",
  "tags",
  "derived",
  "annotations",
] as const);

export interface WorkflowDatasetReferenceCompatibility {
  readonly kind: typeof WorkflowDatasetCompatibilityKinds.datasetReference;
  readonly contractVersion: "1.0.0";
  readonly assetRef: Readonly<{
    readonly assetId: string;
    readonly versionId?: string;
  }>;
}

export interface WorkflowMediaImageRecordsCompatibility {
  readonly kind: typeof WorkflowDatasetCompatibilityKinds.mediaImageRecords;
  readonly contractVersion: "1.0.0";
  readonly delivery: "dataset-reference";
  readonly schemaIntentId: "media";
  readonly recordContract: Readonly<{
    readonly id: typeof ImageRecordContractIdentifier;
    readonly version: string;
    readonly minimumCompatibleVersion: string;
  }>;
  readonly stableFieldKeys: ReadonlyArray<string>;
  readonly selectedFieldKeys?: ReadonlyArray<string>;
}

export type WorkflowDatasetCompatibilityContract =
  | WorkflowDatasetReferenceCompatibility
  | WorkflowMediaImageRecordsCompatibility;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  return Object.freeze([...new Set(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )]);
}

function inferMediaSelection(input: {
  readonly selection?: Readonly<Record<string, unknown>>;
}): boolean {
  const schemaIntentId = normalizeOptional(
    typeof input.selection?.schemaIntentId === "string"
      ? input.selection.schemaIntentId
      : undefined,
  );
  const shapeKind = normalizeOptional(
    typeof input.selection?.shapeKind === "string"
      ? input.selection.shapeKind
      : undefined,
  );
  const recordContract = normalizeOptional(
    typeof input.selection?.recordContract === "string"
      ? input.selection.recordContract
      : undefined,
  );

  return schemaIntentId === "media"
    || shapeKind === "image-metadata-records"
    || recordContract === ImageRecordContractIdentifier;
}

function inferSelectedMediaFieldKeys(input: {
  readonly selection?: Readonly<Record<string, unknown>>;
}): ReadonlyArray<string> | undefined {
  const selected = normalizeStringArray(input.selection?.fields);
  if (selected.length === 0) {
    return undefined;
  }

  const stable = new Set<string>(WorkflowMediaImageStableFieldKeys);
  const filtered = selected.filter((entry) => stable.has(entry));
  return filtered.length > 0 ? Object.freeze(filtered) : undefined;
}

export function buildWorkflowDatasetCompatibilityContract(input: {
  readonly assetId: string;
  readonly versionId?: string;
  readonly selection?: Readonly<Record<string, unknown>>;
}): WorkflowDatasetCompatibilityContract | undefined {
  const assetId = input.assetId.trim();
  if (!assetId) {
    return undefined;
  }

  if (!inferMediaSelection(input)) {
    return Object.freeze({
      kind: WorkflowDatasetCompatibilityKinds.datasetReference,
      contractVersion: "1.0.0",
      assetRef: Object.freeze({
        assetId,
        versionId: normalizeOptional(input.versionId),
      }),
    } satisfies WorkflowDatasetReferenceCompatibility);
  }

  return Object.freeze({
    kind: WorkflowDatasetCompatibilityKinds.mediaImageRecords,
    contractVersion: "1.0.0",
    delivery: "dataset-reference",
    schemaIntentId: "media",
    recordContract: Object.freeze({
      id: ImageRecordContractIdentifier,
      version: ImageRecordSchemaVersions.current,
      minimumCompatibleVersion: ImageRecordSchemaVersions.minimumCompatible,
    }),
    stableFieldKeys: Object.freeze([...WorkflowMediaImageStableFieldKeys]),
    selectedFieldKeys: inferSelectedMediaFieldKeys(input),
  } satisfies WorkflowMediaImageRecordsCompatibility);
}

