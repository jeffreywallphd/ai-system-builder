import { CanonicalDataShapeKinds } from "./CanonicalDataShapes";
import {
  PipelineStageCategories,
  PipelineStageIds,
  createPipelineStageDefinition,
  type PipelineStageDefinition,
  type PipelineStageId,
} from "./PipelineStageDomain";

const AllShapeKinds = Object.freeze(Object.values(CanonicalDataShapeKinds));

const DefaultPipelineStageDefinitions: ReadonlyArray<PipelineStageDefinition> = Object.freeze([
  createPipelineStageDefinition({
    id: PipelineStageIds.SourceSelection,
    displayName: "Source Selection",
    description: "Resolves source references and source capabilities before ingestion execution.",
    category: PipelineStageCategories.selection,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      before: Object.freeze([PipelineStageIds.UnifiedIngestion]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.UnifiedIngestion,
    displayName: "Unified Ingestion",
    description: "Routes sources to the appropriate ingestion adapters and canonical output shaping.",
    category: PipelineStageCategories.ingestion,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.SourceSelection]),
      before: Object.freeze([PipelineStageIds.StorageRaw, PipelineStageIds.Profiling, PipelineStageIds.Extraction]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.StorageRaw,
    displayName: "Raw Storage",
    description: "Persists source payload and traceability metadata prior to transformation stages.",
    category: PipelineStageCategories.storage,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.UnifiedIngestion]),
      before: Object.freeze([PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: false,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Profiling,
    displayName: "Profiling",
    description: "Collects dataset-quality and type profile signals for downstream decisions.",
    category: PipelineStageCategories.profiling,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: true,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.UnifiedIngestion]),
      before: Object.freeze([PipelineStageIds.Classification, PipelineStageIds.Normalization]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Classification,
    displayName: "Classification",
    description: "Applies deterministic tagging and semantic classification over canonical records.",
    category: PipelineStageCategories.classification,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: true,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Profiling]),
      before: Object.freeze([PipelineStageIds.Labeling]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Normalization,
    displayName: "Normalization",
    description: "Normalizes values and data types into canonical contracts.",
    category: PipelineStageCategories.normalization,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Profiling]),
      before: Object.freeze([PipelineStageIds.Cleaning]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Cleaning,
    displayName: "Cleaning",
    description: "Runs missing-value handling, deduplication, and optional filtering policies.",
    category: PipelineStageCategories.cleaning,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Normalization]),
      before: Object.freeze([PipelineStageIds.Transformation]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Transformation,
    displayName: "Transformation",
    description: "Applies deterministic field mapping and validation transformations.",
    category: PipelineStageCategories.transformation,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Cleaning]),
      before: Object.freeze([PipelineStageIds.Enrichment, PipelineStageIds.FeatureEngineering, PipelineStageIds.Aggregation]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Enrichment,
    displayName: "Enrichment",
    description: "Combines external joins and enrichment transforms with canonical stage outputs.",
    category: PipelineStageCategories.enrichment,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Transformation]),
      before: Object.freeze([PipelineStageIds.FeatureEngineering, PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.FeatureEngineering,
    displayName: "Feature Engineering",
    description: "Generates derived features for model-ready prepared datasets.",
    category: PipelineStageCategories.featureEngineering,
    allowedInputTypes: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
    ]),
    producedOutputTypes: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
    ]),
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Enrichment, PipelineStageIds.Transformation]),
      before: Object.freeze([PipelineStageIds.Aggregation, PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Extraction,
    displayName: "Extraction",
    description: "Extracts text and structured content from documents or image sources.",
    category: PipelineStageCategories.extraction,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.textItems,
      CanonicalDataShapeKinds.imageMetadataRecords,
    ]),
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.UnifiedIngestion]),
      before: Object.freeze([PipelineStageIds.Chunking]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Chunking,
    displayName: "Chunking",
    description: "Splits text artifacts into chunked units for downstream processing.",
    category: PipelineStageCategories.chunking,
    allowedInputTypes: Object.freeze([CanonicalDataShapeKinds.textItems]),
    producedOutputTypes: Object.freeze([CanonicalDataShapeKinds.textItems]),
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Extraction]),
      before: Object.freeze([PipelineStageIds.Labeling, PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Aggregation,
    displayName: "Aggregation",
    description: "Applies grouped aggregate computations for summary-level outputs.",
    category: PipelineStageCategories.aggregation,
    allowedInputTypes: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
    ]),
    producedOutputTypes: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
    ]),
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Transformation, PipelineStageIds.FeatureEngineering]),
      before: Object.freeze([PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.Labeling,
    displayName: "Labeling",
    description: "Adds labels and annotations used for supervised preparation and evaluation.",
    category: PipelineStageCategories.labeling,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: true,
    defaultEnabled: false,
    orderingConstraints: Object.freeze({
      after: Object.freeze([PipelineStageIds.Classification, PipelineStageIds.Chunking, PipelineStageIds.Transformation]),
      before: Object.freeze([PipelineStageIds.StoragePrepared]),
    }),
    supportsPreview: true,
  }),
  createPipelineStageDefinition({
    id: PipelineStageIds.StoragePrepared,
    displayName: "Prepared Storage",
    description: "Persists prepared dataset artifacts and lineage after stage composition execution.",
    category: PipelineStageCategories.storage,
    allowedInputTypes: AllShapeKinds,
    producedOutputTypes: AllShapeKinds,
    isOptional: false,
    defaultEnabled: true,
    orderingConstraints: Object.freeze({
      after: Object.freeze([
        PipelineStageIds.Transformation,
        PipelineStageIds.Enrichment,
        PipelineStageIds.FeatureEngineering,
        PipelineStageIds.Aggregation,
        PipelineStageIds.Labeling,
      ]),
    }),
    supportsPreview: false,
  }),
]);

function validateRegistry(definitions: ReadonlyArray<PipelineStageDefinition>): void {
  const idSet = new Set<PipelineStageId>();
  for (const definition of definitions) {
    if (idSet.has(definition.id)) {
      throw new Error(`Pipeline stage registry includes duplicate stage id '${definition.id}'.`);
    }
    idSet.add(definition.id);
  }

  for (const definition of definitions) {
    for (const beforeId of definition.orderingConstraints.before ?? []) {
      if (!idSet.has(beforeId)) {
        throw new Error(`Stage '${definition.id}' references unknown 'before' stage '${beforeId}'.`);
      }
    }
    for (const afterId of definition.orderingConstraints.after ?? []) {
      if (!idSet.has(afterId)) {
        throw new Error(`Stage '${definition.id}' references unknown 'after' stage '${afterId}'.`);
      }
    }
  }
}

export class PipelineStageRegistry {
  private readonly definitionsById: ReadonlyMap<PipelineStageId, PipelineStageDefinition>;

  constructor(definitions: ReadonlyArray<PipelineStageDefinition> = DefaultPipelineStageDefinitions) {
    const normalized = definitions.map((definition) => createPipelineStageDefinition(definition));
    validateRegistry(normalized);
    this.definitionsById = new Map(normalized.map((definition) => [definition.id, Object.freeze({ ...definition })]));
  }

  public has(stageId: PipelineStageId): boolean {
    return this.definitionsById.has(stageId);
  }

  public getDefinition(stageId: PipelineStageId): PipelineStageDefinition {
    const definition = this.definitionsById.get(stageId);
    if (!definition) {
      throw new Error(`Pipeline stage '${stageId}' is not registered.`);
    }
    return definition;
  }

  public listDefinitions(): ReadonlyArray<PipelineStageDefinition> {
    return Object.freeze([...this.definitionsById.values()]);
  }

  public inspect(): Readonly<Record<PipelineStageId, PipelineStageDefinition>> {
    return Object.freeze(
      Object.fromEntries(this.listDefinitions().map((definition) => [definition.id, definition])) as Record<
        PipelineStageId,
        PipelineStageDefinition
      >,
    );
  }
}

export function createPipelineStageRegistry(
  definitions?: ReadonlyArray<PipelineStageDefinition>,
): PipelineStageRegistry {
  return new PipelineStageRegistry(definitions);
}