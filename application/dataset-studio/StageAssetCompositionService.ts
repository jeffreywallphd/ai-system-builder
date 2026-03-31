import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  PipelineStageConfigModes,
  PipelineStageIds,
  type PipelineStageConfig,
  type PipelineStageDefinition,
  type PipelineStageId,
} from "../../domain/dataset-studio/PipelineStageDomain";
import {
  DatasetIngestionStageAssetIds,
  DatasetTransformationStageAssetIds,
} from "../../domain/dataset-studio/StagePipelineDomain";

export interface ConfigMappingRule {
  readonly stageConfigKey: string;
  readonly assetConfigKey: string;
  readonly required?: boolean;
  readonly defaultValue?: CanonicalRecordValue;
}

export interface CompositionCondition {
  readonly inputTypes?: ReadonlyArray<CanonicalDataShapeKind>;
  readonly optionEquals?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface AssetReference {
  readonly assetId: string;
  readonly version?: string;
  readonly role: string;
  readonly configMapping: ReadonlyArray<ConfigMappingRule>;
  readonly staticConfig?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly condition?: CompositionCondition;
}

export interface AssetGroup {
  readonly id: string;
  readonly executionOrder: number;
  readonly assets: ReadonlyArray<AssetReference>;
  readonly executionMode: "sequential";
  readonly condition?: CompositionCondition;
}

export interface StageCompositionDefinition {
  readonly stageId: PipelineStageId;
  readonly groups: ReadonlyArray<AssetGroup>;
  readonly inspectable: boolean;
}

export type AssetCompositionDefinition = StageCompositionDefinition;

export interface ResolvedAssetReference {
  readonly assetId: string;
  readonly version?: string;
  readonly role: string;
  readonly config: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface ResolvedAssetGroup {
  readonly id: string;
  readonly executionOrder: number;
  readonly executionMode: "sequential";
  readonly assets: ReadonlyArray<ResolvedAssetReference>;
}

export interface ResolvedStageComposition {
  readonly stageId: PipelineStageId;
  readonly inspectable: boolean;
  readonly groups: ReadonlyArray<ResolvedAssetGroup>;
}

export interface StageAssetGraphNodeData {
  readonly stageId: PipelineStageId;
  readonly groupId: string;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly executionOrder: number;
  readonly role: string;
  readonly inspectable: boolean;
}

export interface StageAssetGraphEdgeData {
  readonly stageId: PipelineStageId;
  readonly kind: "group-flow" | "asset-flow" | "upstream-bridge";
}

export interface StageAssetGraphSegment {
  readonly stageId: PipelineStageId;
  readonly nodes: ReadonlyArray<Node<StageAssetGraphNodeData>>;
  readonly edges: ReadonlyArray<Edge<StageAssetGraphEdgeData>>;
  readonly orderedNodeIds: ReadonlyArray<string>;
}

const ShapeKindSchema = z.nativeEnum(CanonicalDataShapeKinds);

const ConfigMappingRuleSchema = z.object({
  stageConfigKey: z.string().trim().min(1),
  assetConfigKey: z.string().trim().min(1),
  required: z.boolean().optional(),
  defaultValue: z.any().optional(),
});

const CompositionConditionSchema = z.object({
  inputTypes: z.array(ShapeKindSchema).min(1).optional(),
  optionEquals: z.record(z.any()).optional(),
});

const AssetReferenceSchema = z.object({
  assetId: z.string().trim().min(1),
  version: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1),
  configMapping: z.array(ConfigMappingRuleSchema),
  staticConfig: z.record(z.any()).optional(),
  condition: CompositionConditionSchema.optional(),
});

const AssetGroupSchema = z.object({
  id: z.string().trim().min(1),
  executionOrder: z.number().int().positive(),
  assets: z.array(AssetReferenceSchema).min(1),
  executionMode: z.literal("sequential"),
  condition: CompositionConditionSchema.optional(),
});

const StageCompositionDefinitionSchema = z.object({
  stageId: z.nativeEnum(PipelineStageIds),
  groups: z.array(AssetGroupSchema).min(1),
  inspectable: z.boolean(),
});

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function matchesCondition(
  condition: CompositionCondition | undefined,
  inputType: CanonicalDataShapeKind | undefined,
  options: Readonly<Record<string, CanonicalRecordValue>>,
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.inputTypes && condition.inputTypes.length > 0) {
    if (!inputType || !condition.inputTypes.includes(inputType)) {
      return false;
    }
  }

  if (condition.optionEquals) {
    for (const [key, expected] of Object.entries(condition.optionEquals)) {
      if (options[key] !== expected) {
        return false;
      }
    }
  }

  return true;
}

function mapAssetConfig(
  stageConfig: PipelineStageConfig,
  asset: AssetReference,
): Readonly<Record<string, CanonicalRecordValue>> {
  const mapped: Record<string, CanonicalRecordValue> = {
    ...(asset.staticConfig ?? {}),
  };

  for (const rule of asset.configMapping) {
    const valueFromStage = stageConfig.options[rule.stageConfigKey];
    const resolvedValue = valueFromStage ?? rule.defaultValue;
    if (resolvedValue === undefined) {
      if (rule.required) {
        throw new Error(
          `Asset '${asset.assetId}' requires stage config key '${rule.stageConfigKey}'.`,
        );
      }
      continue;
    }
    mapped[rule.assetConfigKey] = resolvedValue;
  }

  return Object.freeze(mapped);
}

const DefaultStageCompositionDefinitions: ReadonlyArray<StageCompositionDefinition> = Object.freeze([
  {
    stageId: PipelineStageIds.SourceSelection,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "source-selection",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "source-resolver",
            configMapping: Object.freeze([
              { stageConfigKey: "outputTarget", assetConfigKey: "outputTarget", defaultValue: CanonicalDataShapeKinds.records },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.UnifiedIngestion,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "ingestion-routing",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.csv,
            version: "1.0.0",
            role: "csv-ingestion",
            condition: { optionEquals: Object.freeze({ strategy: "csv" }) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.json,
            version: "1.0.0",
            role: "json-ingestion",
            condition: { optionEquals: Object.freeze({ strategy: "json" }) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.document,
            version: "1.0.0",
            role: "document-ingestion",
            condition: { optionEquals: Object.freeze({ strategy: "document" }) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-ingestion",
            condition: { optionEquals: Object.freeze({ strategy: "image" }) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "auto-ingestion-router",
            configMapping: Object.freeze([
              { stageConfigKey: "strategy", assetConfigKey: "strategy", defaultValue: "auto" },
              { stageConfigKey: "outputTarget", assetConfigKey: "outputTarget", defaultValue: CanonicalDataShapeKinds.records },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.StorageRaw,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "raw-storage",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.rawStorage,
            version: "1.0.0",
            role: "raw-storage",
            configMapping: Object.freeze([
              { stageConfigKey: "persistRawPayload", assetConfigKey: "persistRawPayload", defaultValue: true },
              { stageConfigKey: "persistSourceReference", assetConfigKey: "persistSourceReference", defaultValue: true },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Profiling,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "profiling",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.dataProfiling,
            version: "1.0.0",
            role: "data-profiling",
            configMapping: Object.freeze([
              { stageConfigKey: "sampleSize", assetConfigKey: "sampleSize", defaultValue: 500 },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Classification,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "classification",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.dataClassification,
            version: "1.0.0",
            role: "data-classification",
            configMapping: Object.freeze([]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Normalization,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "normalization",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.typeNormalization,
            version: "1.0.0",
            role: "type-normalizer",
            configMapping: Object.freeze([
              { stageConfigKey: "trimStrings", assetConfigKey: "trimStrings", defaultValue: true },
              { stageConfigKey: "emptyStringAsNull", assetConfigKey: "emptyStringAsNull", defaultValue: false },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Cleaning,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "cleaning",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.missingValueHandling,
            version: "1.0.0",
            role: "missing-handler",
            configMapping: Object.freeze([
              { stageConfigKey: "missingStrategy", assetConfigKey: "strategy", defaultValue: "leave" },
            ]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.deduplication,
            version: "1.0.0",
            role: "deduplicator",
            configMapping: Object.freeze([
              { stageConfigKey: "dedupeMode", assetConfigKey: "mode", defaultValue: "exact-all" },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Transformation,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "transformation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "field-transform",
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.dataValidation,
            version: "1.0.0",
            role: "data-validator",
            configMapping: Object.freeze([
              { stageConfigKey: "invalidRowStrategy", assetConfigKey: "invalidRowStrategy", defaultValue: "annotate-and-keep" },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Enrichment,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "enrichment-derived",
        executionOrder: 1,
        executionMode: "sequential",
        condition: { optionEquals: Object.freeze({ enrichmentStrategy: "derived" }) },
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "derived-field-compute",
            configMapping: Object.freeze([
              { stageConfigKey: "derivedFields", assetConfigKey: "derivedFields", defaultValue: Object.freeze([]) },
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "enriched" },
            ]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "derived-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "enriched" },
            ]),
          },
        ]),
      },
      {
        id: "enrichment-lookup",
        executionOrder: 1,
        executionMode: "sequential",
        condition: { optionEquals: Object.freeze({ enrichmentStrategy: "lookup" }) },
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "lookup-source",
            configMapping: Object.freeze([
              { stageConfigKey: "lookupSourceAssetId", assetConfigKey: "sourceAssetId" },
              { stageConfigKey: "lookupSourceReference", assetConfigKey: "sourceReference" },
              { stageConfigKey: "lookupInputKey", assetConfigKey: "inputKey", defaultValue: "id" },
              { stageConfigKey: "lookupLookupKey", assetConfigKey: "lookupKey", defaultValue: "id" },
              { stageConfigKey: "lookupJoinType", assetConfigKey: "joinType", defaultValue: "left" },
              { stageConfigKey: "lookupPreserveUnmatched", assetConfigKey: "preserveUnmatched", defaultValue: true },
            ]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "lookup-transform",
            configMapping: Object.freeze([
              { stageConfigKey: "lookupSelectedFields", assetConfigKey: "selectedFields", defaultValue: Object.freeze([]) },
            ]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "lookup-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "enriched" },
            ]),
          },
        ]),
      },
      {
        id: "enrichment-metadata",
        executionOrder: 1,
        executionMode: "sequential",
        condition: { optionEquals: Object.freeze({ enrichmentStrategy: "metadata-augmentation" }) },
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.dataProfiling,
            version: "1.0.0",
            role: "metadata-profiler",
            configMapping: Object.freeze([
              { stageConfigKey: "previewSampleSize", assetConfigKey: "sampleSize", defaultValue: 25 },
              { stageConfigKey: "metadataIncludeProfiling", assetConfigKey: "enabled", defaultValue: true },
            ]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-metadata-augmentation",
            condition: { inputTypes: Object.freeze([CanonicalDataShapeKinds.imageMetadataRecords]) },
            configMapping: Object.freeze([
              { stageConfigKey: "metadataIncludeImageMetadata", assetConfigKey: "extractExif", defaultValue: true },
              { stageConfigKey: "metadataIncludeImageMetadata", assetConfigKey: "generatePreviewMetadata", defaultValue: true },
            ]),
          },
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "metadata-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "metadataStaticFields", assetConfigKey: "staticFields", defaultValue: Object.freeze({}) },
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "enriched" },
            ]),
          },
        ]),
      },
      {
        id: "enrichment-fallback",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "enrichment-fallback-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "enriched" },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.FeatureEngineering,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "feature-engineering",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "derived-field-generator",
            configMapping: Object.freeze([
              { stageConfigKey: "featureSpec", assetConfigKey: "featureSpec" },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Extraction,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "extraction",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.document,
            version: "1.0.0",
            role: "text-extraction",
            condition: { inputTypes: Object.freeze([CanonicalDataShapeKinds.textItems]) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "ocr-extraction",
            condition: { inputTypes: Object.freeze([CanonicalDataShapeKinds.imageMetadataRecords]) },
            configMapping: Object.freeze([]),
          },
          {
            assetId: DatasetIngestionStageAssetIds.document,
            version: "1.0.0",
            role: "generic-extraction",
            configMapping: Object.freeze([]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Chunking,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "chunking",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "text-chunking",
            configMapping: Object.freeze([
              { stageConfigKey: "chunkSize", assetConfigKey: "chunkSize", defaultValue: 512 },
              { stageConfigKey: "chunkOverlap", assetConfigKey: "chunkOverlap", defaultValue: 64 },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Aggregation,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "aggregation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.aggregation,
            version: "1.0.0",
            role: "aggregator",
            configMapping: Object.freeze([
              { stageConfigKey: "groupByFields", assetConfigKey: "groupByFields", defaultValue: Object.freeze([]) },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.Labeling,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "labeling",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetTransformationStageAssetIds.dataClassification,
            version: "1.0.0",
            role: "annotation-labeling",
            configMapping: Object.freeze([
              { stageConfigKey: "emitRecordLevelTags", assetConfigKey: "emitRecordLevelTags", defaultValue: true },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    stageId: PipelineStageIds.StoragePrepared,
    inspectable: true,
    groups: Object.freeze([
      {
        id: "prepared-storage",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          {
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "prepared-storage-writer",
            configMapping: Object.freeze([
              { stageConfigKey: "destination", assetConfigKey: "destination" },
            ]),
          },
        ]),
      },
    ]),
  },
]);

export class StageAssetCompositionService {
  private readonly definitions: ReadonlyMap<PipelineStageId, StageCompositionDefinition>;

  constructor(definitions: ReadonlyArray<StageCompositionDefinition> = DefaultStageCompositionDefinitions) {
    const validated = definitions.map((definition) => {
      const parsed = StageCompositionDefinitionSchema.parse(definition) as StageCompositionDefinition;
      return Object.freeze({
        ...parsed,
        groups: Object.freeze([...parsed.groups].sort((left, right) => left.executionOrder - right.executionOrder)),
      });
    });
    this.definitions = new Map(validated.map((definition) => [definition.stageId, definition]));
  }

  public listDefinitions(): ReadonlyArray<StageCompositionDefinition> {
    return Object.freeze([...this.definitions.values()]);
  }

  public getDefinition(stageId: PipelineStageId): StageCompositionDefinition {
    const definition = this.definitions.get(stageId);
    if (!definition) {
      throw new Error(`No stage composition definition is registered for '${stageId}'.`);
    }
    return definition;
  }

  public resolve(input: {
    readonly stage: PipelineStageDefinition;
    readonly config?: PipelineStageConfig;
  }): ResolvedStageComposition {
    const definition = this.getDefinition(input.stage.id);
    const config = input.config ?? {
      mode: PipelineStageConfigModes.simple,
      options: Object.freeze({}),
    };
    const stageInputType = config.declaredInputType;

    const groups = definition.groups
      .filter((group) => matchesCondition(group.condition, stageInputType, config.options))
      .map((group) => {
        const assets = group.assets
          .filter((asset) => matchesCondition(asset.condition, stageInputType, config.options))
          .map((asset) => Object.freeze({
            assetId: asset.assetId,
            version: normalizeOptional(asset.version),
            role: asset.role,
            config: mapAssetConfig(config, asset),
          }));

        return Object.freeze({
          id: group.id,
          executionOrder: group.executionOrder,
          executionMode: group.executionMode,
          assets: Object.freeze(assets),
        });
      })
      .filter((group) => group.assets.length > 0);

    if (groups.length === 0) {
      throw new Error(`Stage '${input.stage.id}' resolved to no executable asset groups.`);
    }

    return Object.freeze({
      stageId: input.stage.id,
      inspectable: definition.inspectable,
      groups: Object.freeze(groups),
    });
  }

  public toAssetGraphSegment(input: {
    readonly stageId: PipelineStageId;
    readonly composition: ResolvedStageComposition;
    readonly previousNodeIds?: ReadonlyArray<string>;
    readonly idPrefix?: string;
  }): StageAssetGraphSegment {
    const idPrefix = input.idPrefix?.trim() || `stage:${input.stageId}`;
    const nodes: Array<Node<StageAssetGraphNodeData>> = [];
    const edges: Array<Edge<StageAssetGraphEdgeData>> = [];

    const groupNodes = input.composition.groups.map((group, groupIndex) => {
      const groupNodeIds = group.assets.map((asset, assetIndex) => {
        const nodeId = `${idPrefix}:group:${group.id}:asset:${asset.assetId}:${assetIndex + 1}`;
        nodes.push(Object.freeze({
          id: nodeId,
          type: "default",
          position: {
            x: groupIndex * 320,
            y: assetIndex * 180,
          },
          data: Object.freeze({
            stageId: input.stageId,
            groupId: group.id,
            assetId: asset.assetId,
            assetVersion: asset.version,
            executionOrder: group.executionOrder,
            role: asset.role,
            inspectable: input.composition.inspectable,
          }),
        }));
        return nodeId;
      });

      for (let index = 0; index < groupNodeIds.length - 1; index += 1) {
        const source = groupNodeIds[index];
        const target = groupNodeIds[index + 1];
        if (source && target) {
          edges.push(Object.freeze({
            id: `${idPrefix}:edge:asset-flow:${source}->${target}`,
            source,
            target,
            type: "smoothstep",
            data: Object.freeze({
              stageId: input.stageId,
              kind: "asset-flow",
            }),
          }));
        }
      }

      return Object.freeze({
        groupId: group.id,
        nodeIds: Object.freeze(groupNodeIds),
      });
    });

    for (let index = 0; index < groupNodes.length - 1; index += 1) {
      const current = groupNodes[index];
      const next = groupNodes[index + 1];
      if (!current || !next) {
        continue;
      }
      const sourceIds = current.nodeIds.length > 0
        ? [current.nodeIds[current.nodeIds.length - 1]]
        : [];
      const targetIds = next.nodeIds.length > 0
        ? [next.nodeIds[0]]
        : [];

      for (const source of sourceIds) {
        for (const target of targetIds) {
          if (!source || !target) {
            continue;
          }
          edges.push(Object.freeze({
            id: `${idPrefix}:edge:group-flow:${source}->${target}`,
            source,
            target,
            type: "smoothstep",
            data: Object.freeze({
              stageId: input.stageId,
              kind: "group-flow",
            }),
          }));
        }
      }
    }

    const firstGroup = groupNodes[0];
    if (firstGroup && input.previousNodeIds && input.previousNodeIds.length > 0) {
      for (const previousNodeId of input.previousNodeIds) {
        const target = firstGroup.nodeIds[0];
        if (!target) {
          continue;
        }
        edges.push(Object.freeze({
          id: `${idPrefix}:edge:upstream:${previousNodeId}->${target}`,
          source: previousNodeId,
          target,
          type: "smoothstep",
          data: Object.freeze({
            stageId: input.stageId,
            kind: "upstream-bridge",
          }),
        }));
      }
    }

    return Object.freeze({
      stageId: input.stageId,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      orderedNodeIds: Object.freeze(nodes.map((node) => node.id)),
    });
  }
}

export function createStageAssetCompositionService(
  definitions?: ReadonlyArray<StageCompositionDefinition>,
): StageAssetCompositionService {
  return new StageAssetCompositionService(definitions);
}
