import type { PipelineStageId } from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageIds } from "../../domain/dataset-studio/PipelineStageDomain";
import type { UnifiedPreparationAssetDefinition } from "../../domain/dataset-studio/UnifiedPreparationAsset";
import type {
  PreparedDatasetLineageAssetReference,
  PreparedDatasetLineagePipelineReference,
  PreparedDatasetLineageRecord,
  PreparedDatasetLineageSourceReference,
  PreparedDatasetLineageStageReference,
  PreparedDatasetReuseReference,
} from "../../domain/dataset-studio/PreparedDatasetLineage";
import type {
  DataStudioPipelineAuthoringFlowState,
  DataStudioPipelineIdentity,
  DataStudioPipelineStageState,
  DataStudioPipelineTransition,
} from "./DataStudioPipelineState";

export interface DataStudioLineageLinkIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly stageId?: PipelineStageId;
}

export interface DataStudioLineageBuildInput {
  readonly identity: DataStudioPipelineIdentity;
  readonly asset: UnifiedPreparationAssetDefinition;
  readonly stages: ReadonlyArray<DataStudioPipelineStageState>;
  readonly transitions: ReadonlyArray<DataStudioPipelineTransition>;
  readonly flow: DataStudioPipelineAuthoringFlowState;
  readonly templateIntent?: string;
  readonly preparedStorageReference?: string;
}

function dedupeStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]);
}

function dedupeByKey<T>(values: ReadonlyArray<T>, toKey: (value: T) => string): ReadonlyArray<T> {
  const byKey = new Map<string, T>();
  for (const value of values) {
    byKey.set(toKey(value), value);
  }
  return Object.freeze([...byKey.values()]);
}

function normalizeSourceReferences(stages: ReadonlyArray<DataStudioPipelineStageState>): ReadonlyArray<PreparedDatasetLineageSourceReference> {
  const sourceStage = stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
  if (!sourceStage) {
    return Object.freeze([]);
  }

  const sourceReference = typeof sourceStage.options.sourceReference === "string"
    ? sourceStage.options.sourceReference.trim()
    : undefined;
  const sourceAssetId = typeof sourceStage.options.sourceAssetId === "string"
    ? sourceStage.options.sourceAssetId.trim()
    : undefined;
  const sourceVersionId = typeof sourceStage.options.sourceVersionId === "string"
    ? sourceStage.options.sourceVersionId.trim()
    : undefined;
  const sourceKind = typeof sourceStage.options.sourceKind === "string"
    ? sourceStage.options.sourceKind.trim()
    : undefined;

  if (!sourceReference && !sourceAssetId) {
    return Object.freeze([]);
  }

  return Object.freeze([Object.freeze({
    referenceId: "source-selection:primary",
    sourceKind: sourceKind || undefined,
    sourceReference: sourceReference || undefined,
    sourceAssetId: sourceAssetId || undefined,
    sourceVersionId: sourceVersionId || undefined,
  })]);
}

function normalizePipelineReferences(asset: UnifiedPreparationAssetDefinition): ReadonlyArray<PreparedDatasetLineagePipelineReference> {
  return dedupeByKey(
    asset.upstreamBindings.map((binding) => Object.freeze({
      pipelineAssetId: binding.pipelineAssetId.trim(),
      pipelineVersionId: binding.pipelineVersionId?.trim() || undefined,
      outputStageId: binding.outputStageId,
      outputAssetGroupIds: dedupeStrings(binding.outputAssetGroupIds ?? []),
    })),
    (binding) => `${binding.pipelineAssetId}:${binding.pipelineVersionId ?? ""}:${binding.outputStageId ?? ""}`,
  );
}

function normalizeAssetReferences(
  asset: UnifiedPreparationAssetDefinition,
  pipelineReferences: ReadonlyArray<PreparedDatasetLineagePipelineReference>,
): ReadonlyArray<PreparedDatasetLineageAssetReference> {
  const upstreamFromLegacy = (asset.lineage.upstreamAssetIds ?? []).map((assetId) => Object.freeze({
    assetId: assetId.trim(),
    relationship: "source" as const,
  }));
  const fromPipelines = pipelineReferences.map((pipeline) => Object.freeze({
    assetId: pipeline.pipelineAssetId,
    versionId: pipeline.pipelineVersionId,
    relationship: "pipeline" as const,
    stageId: pipeline.outputStageId,
  }));

  return dedupeByKey(
    [...upstreamFromLegacy, ...fromPipelines].filter((entry) => entry.assetId.length > 0),
    (entry) => `${entry.assetId}:${entry.versionId ?? ""}:${entry.relationship}:${entry.stageId ?? ""}`,
  );
}

function normalizeStageReferences(
  stages: ReadonlyArray<DataStudioPipelineStageState>,
  transitions: ReadonlyArray<DataStudioPipelineTransition>,
): ReadonlyArray<PreparedDatasetLineageStageReference> {
  return Object.freeze(stages.map((stage) => Object.freeze({
    stageId: stage.stageId,
    order: stage.order,
    status: stage.status,
    isOptional: stage.stageId !== PipelineStageIds.SourceSelection
      && stage.stageId !== PipelineStageIds.UnifiedIngestion
      && stage.stageId !== PipelineStageIds.StoragePrepared,
    isAvailable: stage.enabled,
    activationMode: stage.activation.mode,
    configMode: stage.configMode,
    optionKeys: Object.freeze(Object.keys(stage.options)),
    assetGroupIds: stage.assetGroupIds,
    dependsOnStageIds: Object.freeze(
      transitions
        .filter((transition) => transition.toStageId === stage.stageId)
        .map((transition) => transition.fromStageId),
    ),
  })));
}

export function buildPreparedDatasetLineage(
  input: DataStudioLineageBuildInput,
): PreparedDatasetLineageRecord {
  const capturedAt = new Date().toISOString();
  const lineageId = input.asset.lineage.lineageId?.trim()
    || `lineage:${input.identity.assetId}:${input.identity.revision}`;
  const pipelineReferences = normalizePipelineReferences(input.asset);
  const assetReferences = normalizeAssetReferences(input.asset, pipelineReferences);
  const sourceReferences = normalizeSourceReferences(input.stages);
  const stageReferences = normalizeStageReferences(input.stages, input.transitions);
  const storagePreparedStage = input.stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
  const storageTargetId = input.asset.storageTarget?.targetId?.trim()
    || (typeof storagePreparedStage?.options.destination === "string"
      ? String(storagePreparedStage.options.destination).trim()
      : undefined);

  return Object.freeze({
    schemaVersion: "1.0.0",
    lineageId,
    capturedAt,
    pipeline: Object.freeze({
      pipelineId: input.identity.pipelineId,
      pipelineAssetId: input.identity.assetId,
      pipelineAssetVersionId: input.identity.assetVersionId,
    }),
    upstream: Object.freeze({
      sources: sourceReferences,
      assets: assetReferences,
      pipelines: pipelineReferences,
    }),
    stages: stageReferences,
    output: Object.freeze({
      preparedAssetId: input.asset.output.preparedAssetId,
      preparedAssetVersionId: input.asset.output.preparedAssetVersionId?.trim() || undefined,
      outputShapeKind: input.asset.output.outputShapeKind,
      storageTargetId,
      storageReference: input.preparedStorageReference?.trim() || undefined,
    }),
    preparationContext: Object.freeze({
      templateId: input.flow.templateId,
      templateIntent: input.templateIntent,
      authoringMode: input.flow.authoringMode,
      presentationMode: input.flow.presentationMode,
      currentStageId: input.flow.currentStageId,
      completedStageIds: input.flow.completedStageIds,
      skippedStageIds: input.flow.skippedStageIds,
    }),
  });
}

export function buildPreparedDatasetReuseReference(
  lineage: PreparedDatasetLineageRecord,
  input?: {
    readonly displayName?: string;
    readonly reusable?: boolean;
    readonly additionalTags?: ReadonlyArray<string>;
  },
): PreparedDatasetReuseReference {
  const reusable = input?.reusable ?? true;
  const tags = dedupeStrings([
    "dataset",
    "prepared",
    "data-studio",
    ...(input?.additionalTags ?? []),
  ]);
  const displayName = input?.displayName?.trim()
    || `Prepared Dataset (${lineage.output.preparedAssetId})`;

  return Object.freeze({
    reuseId: `reuse:${lineage.output.preparedAssetId}:${lineage.output.preparedAssetVersionId ?? "latest"}`,
    assetId: lineage.output.preparedAssetId,
    versionId: lineage.output.preparedAssetVersionId,
    displayName,
    reusable,
    lineageId: lineage.lineageId,
    pipelineAssetId: lineage.pipeline.pipelineAssetId,
    discoverability: Object.freeze({
      semanticRole: "dataset",
      sourceType: "data-studio",
      tags,
      upstreamAssetIds: dedupeStrings(lineage.upstream.assets.map((entry) => entry.assetId)),
    }),
  });
}

export function validatePreparedDatasetLineageLinks(
  lineage: PreparedDatasetLineageRecord,
): ReadonlyArray<DataStudioLineageLinkIssue> {
  const issues: DataStudioLineageLinkIssue[] = [];
  if (!lineage.output.preparedAssetId.trim()) {
    issues.push(Object.freeze({
      code: "lineage.prepared-output.missing-asset-id",
      message: "Prepared output assetId is required for lineage/reuse resolution.",
      severity: "error",
    }));
  }
  if (lineage.upstream.sources.length === 0 && lineage.upstream.assets.length === 0 && lineage.upstream.pipelines.length === 0) {
    issues.push(Object.freeze({
      code: "lineage.upstream.missing",
      message: "Lineage should include at least one upstream source, asset, or pipeline reference.",
      severity: "error",
    }));
  }

  const stageIds = new Set(lineage.stages.map((stage) => stage.stageId));
  for (const stage of lineage.stages) {
    for (const dependency of stage.dependsOnStageIds) {
      if (!stageIds.has(dependency)) {
        issues.push(Object.freeze({
          code: "lineage.stage.invalid-dependency",
          message: `Stage '${stage.stageId}' references missing dependency stage '${dependency}'.`,
          severity: "error",
          stageId: stage.stageId,
        }));
      }
    }
  }

  const preparedStage = lineage.stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
  if (!preparedStage) {
    issues.push(Object.freeze({
      code: "lineage.stage.prepared-storage.missing",
      message: "Lineage must include the StoragePrepared stage.",
      severity: "error",
    }));
  }

  return Object.freeze(issues);
}

export class InMemoryPreparedDatasetReuseCatalog {
  private readonly byAssetId = new Map<string, PreparedDatasetReuseReference>();

  public register(reference: PreparedDatasetReuseReference): void {
    this.byAssetId.set(reference.assetId, reference);
  }

  public resolve(assetId: string): PreparedDatasetReuseReference | undefined {
    return this.byAssetId.get(assetId.trim());
  }

  public list(): ReadonlyArray<PreparedDatasetReuseReference> {
    return Object.freeze([...this.byAssetId.values()]);
  }
}
