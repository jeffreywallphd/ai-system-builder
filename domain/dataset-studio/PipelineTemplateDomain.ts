import { CanonicalDataShapeKinds, type CanonicalDataShapeKind, type CanonicalRecordValue } from "./CanonicalDataShapes";
import {
  DatasetIngestionStageAssetIds,
  DatasetPipelineStageExecutionModes,
  DatasetPipelineStageKinds,
  DatasetTransformationStageAssetIds,
  createDatasetPipelineDefinition,
  type DatasetPipelineDefinition,
  type DatasetPipelineStageDefinition,
} from "./StagePipelineDomain";
import {
  createStageFlowDefinition,
  type StageFlowDefinition,
  type StageFlowMutableDefinition,
} from "./StageFlowDefinition";

export const PipelineTemplateUseCaseTypes = Object.freeze({
  analytics: "analytics",
  ml: "ml",
  document: "document",
  elt: "elt",
} as const);

export type PipelineTemplateUseCaseType =
  typeof PipelineTemplateUseCaseTypes[keyof typeof PipelineTemplateUseCaseTypes];

export interface PipelineTemplateMetadata {
  readonly useCaseType?: PipelineTemplateUseCaseType;
  readonly tags?: ReadonlyArray<string>;
}

export interface PipelineTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stageFlow: StageFlowDefinition;
  readonly metadata?: PipelineTemplateMetadata;
  readonly defaultStageConfiguration?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

export interface PipelineTemplateUiStage {
  readonly stageId: string;
  readonly stageKind: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly executionMode: string;
  readonly metadata: {
    readonly acceptedInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
    readonly producedOutputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
    readonly assetReferences: ReadonlyArray<DatasetPipelineStageDefinition["assetReferences"][number]>;
  };
  readonly defaultConfiguration: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface PipelineTemplateUiDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly metadata?: PipelineTemplateMetadata;
  readonly stages: ReadonlyArray<PipelineTemplateUiStage>;
}

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

const AllShapeKinds = Object.freeze([
  CanonicalDataShapeKinds.records,
  CanonicalDataShapeKinds.table,
  CanonicalDataShapeKinds.textItems,
  CanonicalDataShapeKinds.imageMetadataRecords,
] as ReadonlyArray<CanonicalDataShapeKind>);

function createStage(
  input: {
    readonly id: string;
    readonly kind: DatasetPipelineStageDefinition["kind"];
    readonly order: number;
    readonly name: string;
    readonly description: string;
    readonly executionMode?: DatasetPipelineStageDefinition["executionPolicy"]["mode"];
    readonly conditionId?: string;
    readonly skipByDefault?: boolean;
    readonly assetIds?: ReadonlyArray<string>;
    readonly acceptedInputShapeKinds?: ReadonlyArray<CanonicalDataShapeKind>;
    readonly producedOutputShapeKinds?: ReadonlyArray<CanonicalDataShapeKind>;
  },
): DatasetPipelineStageDefinition {
  return Object.freeze({
    id: normalizeRequired(input.id, "stage.id"),
    kind: input.kind,
    order: input.order,
    name: normalizeRequired(input.name, `${input.id}.name`),
    description: normalizeRequired(input.description, `${input.id}.description`),
    dataContract: Object.freeze({
      acceptedInputShapeKinds: Object.freeze(input.acceptedInputShapeKinds ?? [...AllShapeKinds]),
      producedOutputShapeKinds: Object.freeze(input.producedOutputShapeKinds ?? [...AllShapeKinds]),
    }),
    assetReferences: Object.freeze((input.assetIds ?? [DatasetIngestionStageAssetIds.unified]).map((assetId) => Object.freeze({
      assetId,
    }))),
    executionPolicy: Object.freeze({
      mode: input.executionMode ?? DatasetPipelineStageExecutionModes.required,
      conditionId: normalizeOptional(input.conditionId),
      skipByDefault: Boolean(input.skipByDefault),
    }),
  });
}

function toStageFlowDefinition(definition: DatasetPipelineDefinition): StageFlowDefinition {
  const flowInput: StageFlowMutableDefinition = Object.freeze({
    flowId: definition.pipelineId,
    name: definition.name,
    description: definition.description,
    stages: definition.stages,
    conditionalTransitions: Object.freeze([]),
  });
  return createStageFlowDefinition(flowInput);
}

export function createPipelineTemplate(input: {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stageFlow: StageFlowDefinition;
  readonly metadata?: PipelineTemplateMetadata;
  readonly defaultStageConfiguration?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}): PipelineTemplate {
  const id = normalizeRequired(input.id, "PipelineTemplate.id");
  const name = normalizeRequired(input.name, "PipelineTemplate.name");
  const description = normalizeRequired(input.description, "PipelineTemplate.description");

  const defaultStageConfiguration = Object.freeze(
    Object.entries(input.defaultStageConfiguration ?? {}).reduce<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>((accumulator, [stageId, config]) => {
      accumulator[normalizeRequired(stageId, "PipelineTemplate.defaultStageConfiguration.stageId")] = Object.freeze({ ...config });
      return accumulator;
    }, {}),
  );

  return Object.freeze({
    id,
    name,
    description,
    stageFlow: input.stageFlow,
    metadata: input.metadata,
    defaultStageConfiguration,
  });
}

export function createDefaultPipelineTemplates(): ReadonlyArray<PipelineTemplate> {
  const eltDefinition = createDatasetPipelineDefinition({
    pipelineId: "template-elt-pipeline",
    name: "ELT Pipeline",
    description: "Source to prepared storage flow optimized for extraction, load, and transformation.",
    stages: Object.freeze([
      createStage({ id: "source", kind: DatasetPipelineStageKinds.source, order: 1, name: "Source", description: "Selects source systems and source metadata." }),
      createStage({ id: "ingestion", kind: DatasetPipelineStageKinds.ingestion, order: 2, name: "Ingestion", description: "Loads source payloads into the ingestion boundary." }),
      createStage({
        id: "raw-storage",
        kind: DatasetPipelineStageKinds.rawStorage,
        order: 3,
        name: "Raw Storage",
        description: "Persists raw payloads for replay and traceability.",
        assetIds: Object.freeze([DatasetIngestionStageAssetIds.rawStorage]),
      }),
      createStage({
        id: "normalization",
        kind: DatasetPipelineStageKinds.normalization,
        order: 4,
        name: "Normalization",
        description: "Normalizes records to canonical schema contracts.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.typeNormalization]),
      }),
      createStage({
        id: "cleaning",
        kind: DatasetPipelineStageKinds.cleaning,
        order: 5,
        name: "Cleaning",
        description: "Applies deterministic cleanup and quality rules.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.missingValueHandling]),
      }),
      createStage({
        id: "transformation",
        kind: DatasetPipelineStageKinds.transformation,
        order: 6,
        name: "Transformation",
        description: "Transforms cleansed data into prepared datasets.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.fieldMapping]),
      }),
      createStage({ id: "prepared-storage", kind: DatasetPipelineStageKinds.preparedStorage, order: 7, name: "Prepared Storage", description: "Stores prepared outputs for downstream consumers." }),
    ]),
  });

  const documentDefinition = createDatasetPipelineDefinition({
    pipelineId: "template-document-processing",
    name: "Document Processing Pipeline",
    description: "Document-first processing from ingestion through chunk-ready prepared storage.",
    stages: Object.freeze([
      createStage({ id: "source", kind: DatasetPipelineStageKinds.source, order: 1, name: "Source", description: "Selects document and image sources for extraction." }),
      createStage({ id: "ingestion", kind: DatasetPipelineStageKinds.ingestion, order: 2, name: "Ingestion", description: "Loads source payloads into the processing boundary." }),
      createStage({
        id: "raw-storage",
        kind: DatasetPipelineStageKinds.rawStorage,
        order: 3,
        name: "Raw Storage",
        description: "Persists source references and raw content pointers for traceability.",
        assetIds: Object.freeze([DatasetIngestionStageAssetIds.rawStorage]),
      }),
      createStage({
        id: "extraction",
        kind: DatasetPipelineStageKinds.extraction,
        order: 4,
        name: "Extraction",
        description: "Extracts text/metadata from document or image sources.",
        executionMode: DatasetPipelineStageExecutionModes.conditional,
        conditionId: "requires-extraction",
      }),
      createStage({ id: "chunking", kind: DatasetPipelineStageKinds.chunking, order: 5, name: "Chunking", description: "Chunks extracted text for retrieval and downstream transforms." }),
      createStage({
        id: "transformation",
        kind: DatasetPipelineStageKinds.transformation,
        order: 6,
        name: "Transformation",
        description: "Transforms chunked content into prepared structures.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.fieldMapping]),
      }),
      createStage({ id: "prepared-storage", kind: DatasetPipelineStageKinds.preparedStorage, order: 7, name: "Prepared Storage", description: "Stores processed document outputs for retrieval and analytics." }),
    ]),
  });

  const analyticsDefinition = createDatasetPipelineDefinition({
    pipelineId: "template-analytics-pipeline",
    name: "Analytics Pipeline",
    description: "Analytics-oriented pipeline with profiling and aggregation stages.",
    stages: Object.freeze([
      createStage({ id: "source", kind: DatasetPipelineStageKinds.source, order: 1, name: "Source", description: "Selects data source systems for analytics processing." }),
      createStage({ id: "ingestion", kind: DatasetPipelineStageKinds.ingestion, order: 2, name: "Ingestion", description: "Loads source data for analytics processing." }),
      createStage({
        id: "raw-storage",
        kind: DatasetPipelineStageKinds.rawStorage,
        order: 3,
        name: "Raw Storage",
        description: "Persists source references and raw content pointers for traceability.",
        assetIds: Object.freeze([DatasetIngestionStageAssetIds.rawStorage]),
      }),
      createStage({
        id: "profiling",
        kind: DatasetPipelineStageKinds.profiling,
        order: 4,
        name: "Profiling",
        description: "Builds quality and distribution profiles on loaded data.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.dataProfiling]),
      }),
      createStage({
        id: "cleaning",
        kind: DatasetPipelineStageKinds.cleaning,
        order: 5,
        name: "Cleaning",
        description: "Applies quality rules and missing-value handling.",
        assetIds: Object.freeze([DatasetTransformationStageAssetIds.missingValueHandling]),
      }),
      createStage({ id: "aggregation", kind: DatasetPipelineStageKinds.aggregation, order: 6, name: "Aggregation", description: "Aggregates clean records into analytics-ready metrics." }),
      createStage({ id: "prepared-storage", kind: DatasetPipelineStageKinds.preparedStorage, order: 7, name: "Prepared Storage", description: "Publishes analytics outputs to prepared storage." }),
    ]),
  });

  return Object.freeze([
    createPipelineTemplate({
      id: "elt-default",
      name: "ELT Pipeline",
      description: "Default ELT stage flow template.",
      stageFlow: toStageFlowDefinition(eltDefinition),
      metadata: Object.freeze({ useCaseType: PipelineTemplateUseCaseTypes.elt, tags: Object.freeze(["default", "elt"]) }),
      defaultStageConfiguration: Object.freeze({
        source: Object.freeze({ includeSchemaInference: true }),
        transformation: Object.freeze({ strategy: "set-based" }),
      }),
    }),
    createPipelineTemplate({
      id: "document-default",
      name: "Document Processing Pipeline",
      description: "Default document processing stage flow template.",
      stageFlow: toStageFlowDefinition(documentDefinition),
      metadata: Object.freeze({ useCaseType: PipelineTemplateUseCaseTypes.document, tags: Object.freeze(["default", "document"]) }),
      defaultStageConfiguration: Object.freeze({
        extraction: Object.freeze({ includeLayoutMetadata: true }),
        chunking: Object.freeze({ chunkSize: 500, chunkOverlap: 50 }),
      }),
    }),
    createPipelineTemplate({
      id: "analytics-default",
      name: "Analytics Pipeline",
      description: "Default analytics stage flow template.",
      stageFlow: toStageFlowDefinition(analyticsDefinition),
      metadata: Object.freeze({ useCaseType: PipelineTemplateUseCaseTypes.analytics, tags: Object.freeze(["default", "analytics"]) }),
      defaultStageConfiguration: Object.freeze({
        profiling: Object.freeze({ sampleSize: 1000 }),
        aggregation: Object.freeze({ grain: "daily" }),
      }),
    }),
  ]);
}

export function toPipelineTemplateUiDescriptor(template: PipelineTemplate): PipelineTemplateUiDescriptor {
  return Object.freeze({
    id: template.id,
    name: template.name,
    description: template.description,
    metadata: template.metadata,
    stages: Object.freeze(template.stageFlow.stages.map((stage) => Object.freeze({
      stageId: stage.id,
      stageKind: stage.kind,
      name: stage.name,
      description: stage.description,
      order: stage.order,
      executionMode: stage.executionPolicy.mode,
      metadata: Object.freeze({
        acceptedInputShapeKinds: stage.dataContract.acceptedInputShapeKinds,
        producedOutputShapeKinds: stage.dataContract.producedOutputShapeKinds,
        assetReferences: stage.assetReferences,
      }),
      defaultConfiguration: template.defaultStageConfiguration?.[stage.id] ?? Object.freeze({}),
    }))),
  });
}
