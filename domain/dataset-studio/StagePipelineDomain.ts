import { CanonicalDataShapeKinds, type CanonicalDataShapeKind } from "./CanonicalDataShapes";

export const DatasetPipelineStageKinds = Object.freeze({
  source: "source",
  sourceSelection: "source-selection",
  ingestion: "ingestion",
  rawStorage: "raw-storage",
  extraction: "extraction",
  chunking: "chunking",
  profiling: "profiling",
  classification: "classification",
  normalization: "normalization",
  cleaning: "cleaning",
  transformation: "transformation",
  featureEngineering: "feature-engineering",
  aggregation: "aggregation",
  preparedStorage: "prepared-storage",
  preview: "preview",
} as const);

export type DatasetPipelineStageKind = typeof DatasetPipelineStageKinds[keyof typeof DatasetPipelineStageKinds];

export const DatasetPipelineStageExecutionModes = Object.freeze({
  required: "required",
  optional: "optional",
  conditional: "conditional",
} as const);

export type DatasetPipelineStageExecutionMode =
  typeof DatasetPipelineStageExecutionModes[keyof typeof DatasetPipelineStageExecutionModes];

export interface DatasetPipelineStageDataContract {
  readonly acceptedInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
  readonly producedOutputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
}

export interface DatasetPipelineStageAssetReference {
  readonly assetId: string;
  readonly assetVersion?: string;
}

export interface DatasetPipelineStageExecutionPolicy {
  readonly mode: DatasetPipelineStageExecutionMode;
  readonly conditionId?: string;
  readonly skipByDefault?: boolean;
}

export interface DatasetPipelineStageDefinition {
  readonly id: string;
  readonly kind: DatasetPipelineStageKind;
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly dataContract: DatasetPipelineStageDataContract;
  readonly assetReferences: ReadonlyArray<DatasetPipelineStageAssetReference>;
  readonly executionPolicy: DatasetPipelineStageExecutionPolicy;
}

export interface DatasetPipelineDefinition {
  readonly pipelineId: string;
  readonly name: string;
  readonly description?: string;
  readonly stages: ReadonlyArray<DatasetPipelineStageDefinition>;
}

export const DatasetIngestionStageAssetIds = Object.freeze({
  unified: "unified-ingestion",
  rawStorage: "raw-storage-stage",
  csv: "csv-ingestor",
  json: "json-ingestor",
  document: "document-pdf-ingestor",
  image: "image-ingestor-v1",
} as const);

export const DatasetTransformationStageAssetIds = Object.freeze({
  schemaInference: "schema-inference",
  dataProfiling: "data-profiling",
  dataClassification: "data-classification",
  typeNormalization: "type-normalization",
  missingValueHandling: "missing-value-handling",
  deduplication: "deduplication",
  filtering: "filtering",
  dataValidation: "data-validation",
  fieldMapping: "field-mapping",
  aggregation: "aggregation",
} as const);

const AllCanonicalShapeKinds = Object.freeze(
  Object.values(CanonicalDataShapeKinds) as ReadonlyArray<CanonicalDataShapeKind>,
);

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function dedupeShapeKinds(
  values: ReadonlyArray<CanonicalDataShapeKind>,
  label: string,
): ReadonlyArray<CanonicalDataShapeKind> {
  if (values.length === 0) {
    throw new Error(`${label} must include at least one canonical data shape kind.`);
  }
  return Object.freeze([...new Set(values)]);
}

function normalizeStage(
  stage: DatasetPipelineStageDefinition,
): DatasetPipelineStageDefinition {
  if (!Number.isInteger(stage.order) || stage.order < 1) {
    throw new Error(`Stage '${stage.id}' must have a positive integer order.`);
  }

  const assetReferences = stage.assetReferences.map((asset) => Object.freeze({
    assetId: normalizeRequired(asset.assetId, `${stage.id}.assetReferences.assetId`),
    assetVersion: normalizeOptional(asset.assetVersion),
  }));
  if (assetReferences.length === 0) {
    throw new Error(`Stage '${stage.id}' must reference at least one underlying asset.`);
  }

  const executionPolicy = Object.freeze({
    mode: stage.executionPolicy.mode,
    conditionId: normalizeOptional(stage.executionPolicy.conditionId),
    skipByDefault: Boolean(stage.executionPolicy.skipByDefault),
  } satisfies DatasetPipelineStageExecutionPolicy);
  if (executionPolicy.mode === DatasetPipelineStageExecutionModes.conditional && !executionPolicy.conditionId) {
    throw new Error(`Conditional stage '${stage.id}' requires a non-empty conditionId.`);
  }

  return Object.freeze({
    id: normalizeRequired(stage.id, "DatasetPipelineStageDefinition.id"),
    kind: stage.kind,
    order: stage.order,
    name: normalizeRequired(stage.name, `${stage.id}.name`),
    description: normalizeRequired(stage.description, `${stage.id}.description`),
    dataContract: Object.freeze({
      acceptedInputShapeKinds: dedupeShapeKinds(stage.dataContract.acceptedInputShapeKinds, `${stage.id}.acceptedInputShapeKinds`),
      producedOutputShapeKinds: dedupeShapeKinds(stage.dataContract.producedOutputShapeKinds, `${stage.id}.producedOutputShapeKinds`),
    }),
    assetReferences: Object.freeze(assetReferences),
    executionPolicy,
  });
}

export function createDatasetPipelineDefinition(
  input: DatasetPipelineDefinition,
): DatasetPipelineDefinition {
  const pipelineId = normalizeRequired(input.pipelineId, "DatasetPipelineDefinition.pipelineId");
  const name = normalizeRequired(input.name, "DatasetPipelineDefinition.name");
  const description = normalizeOptional(input.description);
  if (input.stages.length === 0) {
    throw new Error(`Pipeline '${pipelineId}' must include at least one stage.`);
  }

  const stages = input.stages.map((stage) => normalizeStage(stage)).sort((left, right) => left.order - right.order);
  const stageIds = new Set<string>();
  const stageOrders = new Set<number>();
  for (const stage of stages) {
    if (stageIds.has(stage.id)) {
      throw new Error(`Pipeline '${pipelineId}' includes duplicate stage id '${stage.id}'.`);
    }
    if (stageOrders.has(stage.order)) {
      throw new Error(`Pipeline '${pipelineId}' includes duplicate stage order '${stage.order}'.`);
    }
    stageIds.add(stage.id);
    stageOrders.add(stage.order);
  }

  return Object.freeze({
    pipelineId,
    name,
    description,
    stages: Object.freeze(stages),
  });
}

export function createUnifiedIngestionStagePipelineDefinition(): DatasetPipelineDefinition {
  return createDatasetPipelineDefinition({
    pipelineId: "dataset-unified-ingestion",
    name: "Dataset Unified Ingestion Pipeline",
    description: "High-level stage wrappers over existing ingestion and unified asset capabilities.",
    stages: Object.freeze([
      Object.freeze({
        id: "source-selection",
        kind: DatasetPipelineStageKinds.sourceSelection,
        order: 1,
        name: "Source Selection",
        description: "Resolves source references and derives ingest posture before execution.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.unified }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.required,
        }),
      }),
      Object.freeze({
        id: "ingestion",
        kind: DatasetPipelineStageKinds.ingestion,
        order: 2,
        name: "Ingestion",
        description: "Routes the source kind to CSV/JSON/document/image ingestors.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.unified }),
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.csv }),
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.json }),
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.document }),
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.image }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.conditional,
          conditionId: "detected-source-kind",
        }),
      }),
      Object.freeze({
        id: "raw-storage",
        kind: DatasetPipelineStageKinds.rawStorage,
        order: 3,
        name: "Raw Storage",
        description: "Persists original source references and raw payload storage pointers for traceability.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.rawStorage }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.optional,
          skipByDefault: true,
        }),
      }),
      Object.freeze({
        id: "profiling",
        kind: DatasetPipelineStageKinds.profiling,
        order: 4,
        name: "Profiling",
        description: "Collects bounded profile and quality metadata on normalized outputs.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetTransformationStageAssetIds.dataProfiling }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.optional,
          skipByDefault: true,
        }),
      }),
      Object.freeze({
        id: "normalization",
        kind: DatasetPipelineStageKinds.normalization,
        order: 5,
        name: "Normalization",
        description: "Aligns routed output with canonical shape contracts.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetTransformationStageAssetIds.typeNormalization }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.required,
        }),
      }),
      Object.freeze({
        id: "preview",
        kind: DatasetPipelineStageKinds.preview,
        order: 6,
        name: "Preview",
        description: "Produces optional preview summaries for inspection surfaces.",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: AllCanonicalShapeKinds,
          producedOutputShapeKinds: AllCanonicalShapeKinds,
        }),
        assetReferences: Object.freeze([
          Object.freeze({ assetId: DatasetIngestionStageAssetIds.unified }),
        ]),
        executionPolicy: Object.freeze({
          mode: DatasetPipelineStageExecutionModes.optional,
          skipByDefault: true,
        }),
      }),
    ]),
  });
}
