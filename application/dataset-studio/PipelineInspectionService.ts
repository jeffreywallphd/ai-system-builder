import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  CanonicalDataShapeKinds,
  isCanonicalDataShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import type {
  PipelineGraph,
  PipelineGraphAssetNode,
  PipelineGraphNode,
  PipelineGraphStageNode,
} from "../../domain/dataset-studio/PipelineGraphDomain";
import { validatePipelineGraph } from "../../domain/dataset-studio/PipelineGraphDomain";
import {
  PipelineExecutionStatusKinds,
  validatePipelineInspectionResult,
  type AssetInspectionResult,
  type InspectionMetadata,
  type PipelineExecutionStatus,
  type PipelineInspectionResult,
  type PipelinePreviewData,
  type PipelinePreviewEnvelope,
  type StageInspectionResult,
} from "../../domain/dataset-studio/PipelineInspectionDomain";
import {
  PipelineStageIds,
  type PipelineStageId,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { FeatureEngineeringOperationKinds, parseFeatureEngineeringStageConfigFromStageOptions } from "../../domain/dataset-studio/FeatureEngineeringStageDomain";
import { AnnotationStatusKinds, parseLabelingStageConfigFromStageOptions } from "../../domain/dataset-studio/LabelingStageDomain";

export interface PipelineInspectionExecutionResult {
  readonly pipelineGraph?: PipelineGraph;
  readonly stageStatusById?: Readonly<Record<string, PipelineExecutionStatus>>;
  readonly stageOutputById?: Readonly<Record<string, CanonicalDataShape | Readonly<Record<string, unknown>>>>;
  readonly stageMetadataById?: Readonly<Record<string, InspectionMetadata>>;
  readonly assetStatusByNodeId?: Readonly<Record<string, PipelineExecutionStatus>>;
  readonly assetOutputByNodeId?: Readonly<Record<string, CanonicalDataShape | Readonly<Record<string, unknown>>>>;
  readonly assetMetadataByNodeId?: Readonly<Record<string, InspectionMetadata>>;
}

export interface PipelineInspectionPreviewOptions {
  readonly maxRecords: number;
  readonly maxRows: number;
  readonly maxTextItems: number;
  readonly maxImageItems: number;
}

export interface StageInspectionEnrichmentContext {
  readonly stageNode: PipelineGraphStageNode;
  readonly executionResult: PipelineInspectionExecutionResult;
  readonly stageOutput?: CanonicalDataShape | Readonly<Record<string, unknown>>;
  readonly stageMetadata: InspectionMetadata;
}

export interface AssetInspectionEnrichmentContext {
  readonly assetNode: PipelineGraphAssetNode;
  readonly executionResult: PipelineInspectionExecutionResult;
  readonly assetOutput?: CanonicalDataShape | Readonly<Record<string, unknown>>;
  readonly assetMetadata: InspectionMetadata;
}

export interface PipelineInspectionHooks {
  readonly stage?: ReadonlyArray<(context: StageInspectionEnrichmentContext) => Partial<InspectionMetadata> | undefined>;
  readonly asset?: ReadonlyArray<(context: AssetInspectionEnrichmentContext) => Partial<InspectionMetadata> | undefined>;
}

export interface PipelineInspectionServiceOptions {
  readonly preview?: Partial<PipelineInspectionPreviewOptions>;
  readonly hooks?: PipelineInspectionHooks;
  readonly enableCaching?: boolean;
}

const DefaultPreviewOptions: PipelineInspectionPreviewOptions = Object.freeze({
  maxRecords: 25,
  maxRows: 25,
  maxTextItems: 25,
  maxImageItems: 25,
});

const ExecutionStatusPriority: ReadonlyArray<PipelineExecutionStatus> = Object.freeze([
  PipelineExecutionStatusKinds.failed,
  PipelineExecutionStatusKinds.running,
  PipelineExecutionStatusKinds.pending,
  PipelineExecutionStatusKinds.complete,
]);

function mergeMetadata(
  base: InspectionMetadata | undefined,
  ...enrichments: Array<Partial<InspectionMetadata> | undefined>
): InspectionMetadata {
  const merged: InspectionMetadata = {
    rowCount: base?.rowCount,
    itemCount: base?.itemCount,
    schema: base?.schema,
    summaryStats: base?.summaryStats,
  };

  for (const enrichment of enrichments) {
    if (!enrichment) {
      continue;
    }
    merged.rowCount = enrichment.rowCount ?? merged.rowCount;
    merged.itemCount = enrichment.itemCount ?? merged.itemCount;
    merged.schema = enrichment.schema ?? merged.schema;
    merged.summaryStats = {
      ...(merged.summaryStats ?? {}),
      ...(enrichment.summaryStats ?? {}),
    };
  }

  return Object.freeze(merged);
}

function deriveStatus(statuses: ReadonlyArray<PipelineExecutionStatus>): PipelineExecutionStatus {
  if (statuses.length === 0) {
    return PipelineExecutionStatusKinds.pending;
  }

  for (const status of ExecutionStatusPriority) {
    if (statuses.includes(status)) {
      return status;
    }
  }
  return PipelineExecutionStatusKinds.pending;
}

function deriveMetadataFromCanonicalShape(shape: CanonicalDataShape): InspectionMetadata {
  switch (shape.kind) {
    case CanonicalDataShapeKinds.records: {
      const fieldSet = new Set<string>();
      for (const record of shape.records) {
        for (const fieldName of Object.keys(record.fields)) {
          fieldSet.add(fieldName);
        }
      }
      return Object.freeze({
        rowCount: shape.records.length,
        itemCount: shape.records.length,
        schema: Object.freeze([...fieldSet].sort().map((name) => Object.freeze({ name }))),
      });
    }
    case CanonicalDataShapeKinds.table:
      return Object.freeze({
        rowCount: shape.rows.length,
        itemCount: shape.rows.length,
        schema: Object.freeze(shape.columns.map((column) => Object.freeze({
          name: column.columnId,
          valueType: column.valueType,
        }))),
      });
    case CanonicalDataShapeKinds.textItems:
      return Object.freeze({
        itemCount: shape.items.length,
        schema: Object.freeze([
          Object.freeze({ name: "text", valueType: "string" }),
          Object.freeze({ name: "sourceDocumentId", valueType: "string" }),
          Object.freeze({ name: "startOffset", valueType: "number" }),
          Object.freeze({ name: "endOffset", valueType: "number" }),
        ]),
      });
    case CanonicalDataShapeKinds.imageMetadataRecords:
      return Object.freeze({
        itemCount: shape.items.length,
        schema: Object.freeze([
          Object.freeze({ name: "label", valueType: "string" }),
          Object.freeze({ name: "confidence", valueType: "number" }),
          Object.freeze({ name: "boundingBox", valueType: "object" }),
        ]),
      });
    default:
      return Object.freeze({});
  }
}

function derivePreviewFromCanonicalShape(
  shape: CanonicalDataShape,
  previewOptions: PipelineInspectionPreviewOptions,
): PipelinePreviewData {
  switch (shape.kind) {
    case CanonicalDataShapeKinds.records: {
      const items = shape.records.slice(0, previewOptions.maxRecords);
      return Object.freeze({
        kind: CanonicalDataShapeKinds.records,
        items: Object.freeze(items),
        truncated: shape.records.length > items.length,
        totalCount: shape.records.length,
      });
    }
    case CanonicalDataShapeKinds.table: {
      const rows = shape.rows.slice(0, previewOptions.maxRows);
      return Object.freeze({
        kind: CanonicalDataShapeKinds.table,
        columns: Object.freeze(shape.columns),
        rows: Object.freeze(rows),
        truncated: shape.rows.length > rows.length,
        totalCount: shape.rows.length,
      });
    }
    case CanonicalDataShapeKinds.textItems: {
      const items = shape.items.slice(0, previewOptions.maxTextItems);
      return Object.freeze({
        kind: CanonicalDataShapeKinds.textItems,
        items: Object.freeze(items),
        truncated: shape.items.length > items.length,
        totalCount: shape.items.length,
      });
    }
    case CanonicalDataShapeKinds.imageMetadataRecords: {
      const items = shape.items.slice(0, previewOptions.maxImageItems);
      return Object.freeze({
        kind: CanonicalDataShapeKinds.imageMetadataRecords,
        items: Object.freeze(items),
        truncated: shape.items.length > items.length,
        totalCount: shape.items.length,
      });
    }
    default:
      throw new Error(`Unsupported canonical preview shape '${(shape as { kind: string }).kind}'.`);
  }
}

function toPreviewEnvelope(previewData: PipelinePreviewData): PipelinePreviewEnvelope {
  return Object.freeze({
    version: "1.0.0",
    kind: previewData.kind,
    totalCount: previewData.totalCount,
    truncated: previewData.truncated,
    payload: previewData,
  });
}

function sortStageNodes(nodes: ReadonlyArray<PipelineGraphNode>): ReadonlyArray<PipelineGraphStageNode> {
  return Object.freeze(
    nodes
      .filter((node): node is PipelineGraphStageNode => node.kind === "stage")
      .sort((left, right) => left.data.stageOrder - right.data.stageOrder),
  );
}

function sortAssetNodes(nodes: ReadonlyArray<PipelineGraphNode>): ReadonlyArray<PipelineGraphAssetNode> {
  return Object.freeze(
    nodes
      .filter((node): node is PipelineGraphAssetNode => node.kind === "asset")
      .sort((left, right) => {
        if (left.data.stageOrder !== right.data.stageOrder) {
          return left.data.stageOrder - right.data.stageOrder;
        }
        return left.data.assetOrder - right.data.assetOrder;
      }),
  );
}

function listShapeFields(shape: CanonicalDataShape): ReadonlyArray<string> {
  switch (shape.kind) {
    case CanonicalDataShapeKinds.records: {
      const keys = new Set<string>();
      for (const item of shape.records) {
        Object.keys(item.fields).forEach((key) => keys.add(key));
      }
      return Object.freeze([...keys].sort());
    }
    case CanonicalDataShapeKinds.table:
      return Object.freeze(shape.columns.map((column) => column.columnId).sort());
    case CanonicalDataShapeKinds.textItems:
      return Object.freeze([
        "itemId",
        "text",
        "sourceDocumentId",
        "startOffset",
        "endOffset",
        "metadata",
      ]);
    case CanonicalDataShapeKinds.imageMetadataRecords:
      return Object.freeze([
        "itemId",
        "imageId",
        "label",
        "confidence",
        "boundingBox",
        "attributes",
        "metadata",
      ]);
    default:
      return Object.freeze([]);
  }
}

function resolveUpstreamStageOutput(
  graph: PipelineGraph,
  stageId: PipelineStageId,
  executionResult: PipelineInspectionExecutionResult,
): CanonicalDataShape | undefined {
  const upstreamStageIds = graph.edges
    .filter((edge) => edge.kind === "stage-to-stage" && edge.targetStageId === stageId)
    .map((edge) => edge.sourceStageId);

  for (const upstreamStageId of upstreamStageIds) {
    const output = executionResult.stageOutputById?.[upstreamStageId];
    if (isCanonicalDataShape(output)) {
      return output;
    }
  }

  return undefined;
}

function deriveFeatureEngineeringMetadata(input: {
  readonly stageNode: PipelineGraphStageNode;
  readonly stageOutput?: CanonicalDataShape;
  readonly upstreamOutput?: CanonicalDataShape;
}): Partial<InspectionMetadata> | undefined {
  try {
    const config = parseFeatureEngineeringStageConfigFromStageOptions(input.stageNode.data.config.options);
    const operationTypeCounts: Record<string, number> = {
      [FeatureEngineeringOperationKinds.derivedNumeric]: 0,
      [FeatureEngineeringOperationKinds.categoricalFlag]: 0,
      [FeatureEngineeringOperationKinds.textSummary]: 0,
      [FeatureEngineeringOperationKinds.bucketization]: 0,
      [FeatureEngineeringOperationKinds.projection]: 0,
    };
    const engineeredFields = new Set<string>();
    for (const operation of config.operations) {
      operationTypeCounts[operation.kind] = (operationTypeCounts[operation.kind] ?? 0) + 1;
      if ("targetField" in operation && typeof operation.targetField === "string") {
        engineeredFields.add(operation.targetField);
      }
    }

    const beforeFields = input.upstreamOutput ? listShapeFields(input.upstreamOutput) : Object.freeze([]);
    const afterFields = input.stageOutput ? listShapeFields(input.stageOutput) : Object.freeze([]);
    const beforeFieldSet = new Set(beforeFields);
    const newlyCreatedFields = afterFields.filter((field) => !beforeFieldSet.has(field));

    return Object.freeze({
      summaryStats: Object.freeze({
        "feature.strategy": config.strategy,
        "feature.operationCount": config.operations.length,
        "feature.derivedNumericCount": operationTypeCounts[FeatureEngineeringOperationKinds.derivedNumeric],
        "feature.categoricalFlagCount": operationTypeCounts[FeatureEngineeringOperationKinds.categoricalFlag],
        "feature.textSummaryCount": operationTypeCounts[FeatureEngineeringOperationKinds.textSummary],
        "feature.bucketizationCount": operationTypeCounts[FeatureEngineeringOperationKinds.bucketization],
        "feature.projectionCount": operationTypeCounts[FeatureEngineeringOperationKinds.projection],
        "feature.engineeredFieldCount": engineeredFields.size,
        "feature.newFieldCount": newlyCreatedFields.length,
        "feature.newFields": Object.freeze(newlyCreatedFields),
        "feature.beforeFieldCount": beforeFields.length,
        "feature.afterFieldCount": afterFields.length,
        "feature.beforeAfterPreviewAvailable": Boolean(input.upstreamOutput && input.stageOutput),
      }),
    });
  } catch {
    return undefined;
  }
}

function deriveLabelingMetadata(input: {
  readonly stageNode: PipelineGraphStageNode;
  readonly stageOutput?: CanonicalDataShape;
}): Partial<InspectionMetadata> | undefined {
  try {
    const config = parseLabelingStageConfigFromStageOptions(
      input.stageNode.data.config.options,
      input.stageNode.data.config.declaredInputType,
    );
    const unresolvedCount = config.records.filter((record) => record.status === AnnotationStatusKinds.unresolved).length;
    const manualNeededCount = config.records.filter((record) => record.status === AnnotationStatusKinds.manualNeeded).length;
    const resolvedCount = config.records.filter((record) => record.status === AnnotationStatusKinds.resolved).length;
    const stageItemCount = input.stageOutput?.kind === CanonicalDataShapeKinds.records
      ? input.stageOutput.records.length
      : input.stageOutput?.kind === CanonicalDataShapeKinds.table
        ? input.stageOutput.rows.length
        : input.stageOutput?.kind === CanonicalDataShapeKinds.textItems
          ? input.stageOutput.items.length
          : input.stageOutput?.kind === CanonicalDataShapeKinds.imageMetadataRecords
            ? input.stageOutput.items.length
            : 0;

    return Object.freeze({
      summaryStats: Object.freeze({
        "annotation.mode": config.mode,
        "annotation.target": config.target,
        "annotation.attachmentMode": config.attachmentMode,
        "annotation.recordCount": config.records.length,
        "annotation.resolvedCount": resolvedCount,
        "annotation.unresolvedCount": unresolvedCount,
        "annotation.manualNeededCount": manualNeededCount,
        "annotation.assistanceProvider": config.assistanceProvider,
        "annotation.stageItemCount": stageItemCount,
        "annotation.sampleLabeledOutputAvailable": Boolean(input.stageOutput),
      }),
    });
  } catch {
    return undefined;
  }
}

export class PipelineInspectionService {
  private readonly previewOptions: PipelineInspectionPreviewOptions;
  private readonly hooks: PipelineInspectionHooks;
  private readonly enableCaching: boolean;
  private readonly cache = new Map<string, PipelineInspectionResult>();
  private cachedGraph?: PipelineGraph;

  constructor(options?: PipelineInspectionServiceOptions) {
    this.previewOptions = Object.freeze({
      ...DefaultPreviewOptions,
      ...options?.preview,
    });
    this.hooks = Object.freeze({
      stage: options?.hooks?.stage ?? Object.freeze([]),
      asset: options?.hooks?.asset ?? Object.freeze([]),
    });
    this.enableCaching = options?.enableCaching ?? true;
  }

  public inspectPipeline(
    pipelineGraph: PipelineGraph,
    executionResult: PipelineInspectionExecutionResult,
  ): PipelineInspectionResult {
    const graph = validatePipelineGraph(pipelineGraph);
    this.cachedGraph = graph;
    const cacheKey = this.createCacheKey(graph, executionResult);
    if (this.enableCaching && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const stageNodes = sortStageNodes(graph.nodes);
    const assetNodes = sortAssetNodes(graph.nodes);

    const stageResults = stageNodes.map((stageNode) => this.inspectStageNode(stageNode, executionResult));
    const assetResults = assetNodes.map((assetNode) => this.inspectAssetNode(assetNode, executionResult));
    const status = deriveStatus(stageResults.map((stage) => stage.status));

    const result = validatePipelineInspectionResult(Object.freeze({
      status,
      stages: Object.freeze(stageResults),
      assets: Object.freeze(assetResults),
    }));

    if (this.enableCaching) {
      this.cache.set(cacheKey, result);
    }
    return result;
  }

  public inspectStage(
    stageId: PipelineStageId,
    executionResult: PipelineInspectionExecutionResult,
  ): StageInspectionResult | undefined {
    const graph = this.resolveGraph(executionResult);
    const stageNode = sortStageNodes(graph.nodes).find((node) => node.data.stageId === stageId);
    if (!stageNode) {
      return undefined;
    }
    return this.inspectStageNode(stageNode, executionResult);
  }

  public inspectAsset(
    assetId: string,
    executionResult: PipelineInspectionExecutionResult,
  ): AssetInspectionResult | undefined {
    const graph = this.resolveGraph(executionResult);
    const assetNode = sortAssetNodes(graph.nodes).find((node) => (
      node.id === assetId || node.data.assetId === assetId
    ));
    if (!assetNode) {
      return undefined;
    }
    return this.inspectAssetNode(assetNode, executionResult);
  }

  public attachInspectionMetadata(
    pipelineGraph: PipelineGraph,
    inspectionResult: PipelineInspectionResult,
  ): PipelineGraph {
    const stageById = new Map(inspectionResult.stages.map((stage) => [stage.stageId, stage]));
    const assetByNodeId = new Map(inspectionResult.assets.map((asset) => [asset.assetNodeId, asset]));

    const nodes = pipelineGraph.nodes.map((node) => {
      if (node.kind === "stage") {
        const stage = stageById.get(node.data.stageId);
        return Object.freeze({
          ...node,
          data: Object.freeze({
            ...node.data,
            inspection: stage
              ? Object.freeze({
                status: stage.status,
                metadata: stage.metadata,
                hasPreview: Boolean(stage.previewData),
              })
              : undefined,
          }),
        });
      }

      const asset = assetByNodeId.get(node.id);
      return Object.freeze({
        ...node,
        data: Object.freeze({
          ...node.data,
          inspection: asset
            ? Object.freeze({
              status: asset.status,
              metadata: asset.metadata,
              hasPreview: Boolean(asset.previewData),
            })
            : undefined,
        }),
      });
    });

    return validatePipelineGraph(Object.freeze({
      ...pipelineGraph,
      nodes: Object.freeze(nodes),
    }));
  }

  private inspectStageNode(
    stageNode: PipelineGraphStageNode,
    executionResult: PipelineInspectionExecutionResult,
  ): StageInspectionResult {
    const stageOutput = executionResult.stageOutputById?.[stageNode.data.stageId];
    const stageStatus = executionResult.stageStatusById?.[stageNode.data.stageId]
      ?? PipelineExecutionStatusKinds.pending;
    const graph = this.resolveGraph(executionResult);
    const canonicalStageOutput = isCanonicalDataShape(stageOutput) ? stageOutput : undefined;
    const upstreamOutput = resolveUpstreamStageOutput(graph, stageNode.data.stageId, executionResult);
    const stageSpecificMetadata = stageNode.data.stageId === PipelineStageIds.FeatureEngineering
      ? deriveFeatureEngineeringMetadata({
        stageNode,
        stageOutput: canonicalStageOutput,
        upstreamOutput,
      })
      : stageNode.data.stageId === PipelineStageIds.Labeling
        ? deriveLabelingMetadata({
          stageNode,
          stageOutput: canonicalStageOutput,
        })
        : undefined;

    const stageMetadata = mergeMetadata(
      isCanonicalDataShape(stageOutput) ? deriveMetadataFromCanonicalShape(stageOutput) : undefined,
      executionResult.stageMetadataById?.[stageNode.data.stageId],
      stageSpecificMetadata,
      ...this.hooks.stage?.map((hook) => hook({
        stageNode,
        executionResult,
        stageOutput,
        stageMetadata: executionResult.stageMetadataById?.[stageNode.data.stageId] ?? Object.freeze({}),
      })) ?? [],
    );

    const previewData = isCanonicalDataShape(stageOutput)
      ? derivePreviewFromCanonicalShape(stageOutput, this.previewOptions)
      : undefined;
    const preview = previewData ? toPreviewEnvelope(previewData) : undefined;

    const assets = sortAssetNodes(graph.nodes)
      .filter((assetNode) => assetNode.data.stageId === stageNode.data.stageId)
      .map((assetNode) => this.inspectAssetNode(assetNode, executionResult));

    return Object.freeze({
      stageId: stageNode.data.stageId,
      status: stageStatus,
      preview,
      previewData,
      metadata: stageMetadata,
      assets: Object.freeze(assets),
    });
  }

  private inspectAssetNode(
    assetNode: PipelineGraphAssetNode,
    executionResult: PipelineInspectionExecutionResult,
  ): AssetInspectionResult {
    const assetOutput = executionResult.assetOutputByNodeId?.[assetNode.id];
    const assetStatus = executionResult.assetStatusByNodeId?.[assetNode.id]
      ?? PipelineExecutionStatusKinds.pending;
    const assetMetadata = mergeMetadata(
      isCanonicalDataShape(assetOutput) ? deriveMetadataFromCanonicalShape(assetOutput) : undefined,
      executionResult.assetMetadataByNodeId?.[assetNode.id],
      ...this.hooks.asset?.map((hook) => hook({
        assetNode,
        executionResult,
        assetOutput,
        assetMetadata: executionResult.assetMetadataByNodeId?.[assetNode.id] ?? Object.freeze({}),
      })) ?? [],
    );

    const previewData = isCanonicalDataShape(assetOutput)
      ? derivePreviewFromCanonicalShape(assetOutput, this.previewOptions)
      : undefined;
    const preview = previewData ? toPreviewEnvelope(previewData) : undefined;

    return Object.freeze({
      stageId: assetNode.data.stageId,
      assetId: assetNode.data.assetId,
      assetNodeId: assetNode.id,
      status: assetStatus,
      preview,
      previewData,
      metadata: assetMetadata,
    });
  }

  private resolveGraph(executionResult: PipelineInspectionExecutionResult): PipelineGraph {
    const graph = executionResult.pipelineGraph ?? this.cachedGraph;
    if (!graph) {
      throw new Error("inspectStage/inspectAsset requires executionResult.pipelineGraph or a prior inspectPipeline call.");
    }
    return graph;
  }

  private createCacheKey(
    pipelineGraph: PipelineGraph,
    executionResult: PipelineInspectionExecutionResult,
  ): string {
    const stageStatus = Object.entries(executionResult.stageStatusById ?? {}).sort(([left], [right]) => left.localeCompare(right));
    const assetStatus = Object.entries(executionResult.assetStatusByNodeId ?? {}).sort(([left], [right]) => left.localeCompare(right));
    const stageOutputKinds = Object.entries(executionResult.stageOutputById ?? {}).map(([stageId, output]) => (
      [stageId, isCanonicalDataShape(output) ? output.kind : "none"]
    )).sort(([left], [right]) => left.localeCompare(right));
    const assetOutputKinds = Object.entries(executionResult.assetOutputByNodeId ?? {}).map(([assetNodeId, output]) => (
      [assetNodeId, isCanonicalDataShape(output) ? output.kind : "none"]
    )).sort(([left], [right]) => left.localeCompare(right));

    return JSON.stringify({
      nodeCount: pipelineGraph.nodes.length,
      edgeCount: pipelineGraph.edges.length,
      stageStatus,
      assetStatus,
      stageOutputKinds,
      assetOutputKinds,
    });
  }
}

const DefaultInspectionService = new PipelineInspectionService();

export function inspectPipeline(
  pipelineGraph: PipelineGraph,
  executionResult: PipelineInspectionExecutionResult,
): PipelineInspectionResult {
  return DefaultInspectionService.inspectPipeline(pipelineGraph, executionResult);
}

export function inspectStage(
  stageId: PipelineStageId,
  executionResult: PipelineInspectionExecutionResult,
): StageInspectionResult | undefined {
  return DefaultInspectionService.inspectStage(stageId, executionResult);
}

export function inspectAsset(
  assetId: string,
  executionResult: PipelineInspectionExecutionResult,
): AssetInspectionResult | undefined {
  return DefaultInspectionService.inspectAsset(assetId, executionResult);
}
