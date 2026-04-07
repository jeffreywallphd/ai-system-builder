import { PipelineStageIds, type PipelineStageId } from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import type {
  DataStudioPipelineStageState,
  DataStudioPipelineState,
} from "./DataStudioPipelineState";

export const DataStudioPipelineValidationScopes = Object.freeze({
  stage: "stage",
  transition: "transition",
  pipeline: "pipeline",
  graph: "graph",
} as const);

export type DataStudioPipelineValidationScope =
  typeof DataStudioPipelineValidationScopes[keyof typeof DataStudioPipelineValidationScopes];

export interface DataStudioPipelineValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly blocking: boolean;
  readonly scope: DataStudioPipelineValidationScope;
  readonly stageId?: PipelineStageId;
  readonly relatedStageIds?: ReadonlyArray<PipelineStageId>;
  readonly path?: string;
}

export interface DataStudioStageValidationResult {
  readonly stageId: PipelineStageId;
  readonly ready: boolean;
  readonly status: "ready" | "ready-with-warnings" | "blocked" | "skipped" | "disabled";
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: ReadonlyArray<DataStudioPipelineValidationIssue>;
}

export interface DataStudioPipelineValidationSummary {
  readonly ready: boolean;
  readonly executionReady: boolean;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
}

export interface DataStudioPipelineValidationResult {
  readonly ready: boolean;
  readonly executionReady: boolean;
  readonly issues: ReadonlyArray<DataStudioPipelineValidationIssue>;
  readonly blockingIssues: ReadonlyArray<DataStudioPipelineValidationIssue>;
  readonly warningIssues: ReadonlyArray<DataStudioPipelineValidationIssue>;
  readonly stageResults: ReadonlyArray<DataStudioStageValidationResult>;
  readonly summary: DataStudioPipelineValidationSummary;
}

export interface DataStudioPipelineTransitionValidationRequest {
  readonly fromStageId: PipelineStageId;
  readonly toStageId: PipelineStageId;
}

export interface DataStudioPipelineValidationRequest {
  readonly transition?: DataStudioPipelineTransitionValidationRequest;
  readonly mode?: "authoring" | "execution";
}

function dedupeIssues(
  issues: ReadonlyArray<DataStudioPipelineValidationIssue>,
): ReadonlyArray<DataStudioPipelineValidationIssue> {
  const byKey = new Map<string, DataStudioPipelineValidationIssue>();
  for (const issue of issues) {
    const key = [
      issue.code,
      issue.severity,
      issue.scope,
      issue.stageId ?? "",
      issue.path ?? "",
      issue.message,
      issue.relatedStageIds?.join(",") ?? "",
    ].join("|");
    byKey.set(key, issue);
  }
  return Object.freeze([...byKey.values()]);
}

function stageOrderMap(
  stages: ReadonlyArray<DataStudioPipelineStageState>,
): ReadonlyMap<PipelineStageId, number> {
  return new Map(stages.map((stage) => [stage.stageId, stage.order]));
}

function createIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "error" | "warning";
  readonly scope: DataStudioPipelineValidationScope;
  readonly stageId?: PipelineStageId;
  readonly relatedStageIds?: ReadonlyArray<PipelineStageId>;
  readonly path?: string;
}): DataStudioPipelineValidationIssue {
  const severity = input.severity ?? "error";
  return Object.freeze({
    code: input.code.trim(),
    message: input.message.trim(),
    severity,
    blocking: severity === "error",
    scope: input.scope,
    stageId: input.stageId,
    relatedStageIds: input.relatedStageIds,
    path: input.path,
  });
}

function isStageEnabled(stage: DataStudioPipelineStageState | undefined): boolean {
  return Boolean(stage?.enabled && stage.activation.mode !== "disabled");
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toStageResult(
  stage: DataStudioPipelineStageState,
  issues: ReadonlyArray<DataStudioPipelineValidationIssue>,
): DataStudioStageValidationResult {
  const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
  const warningIssueCount = issues.length - blockingIssueCount;
  const enabled = isStageEnabled(stage);
  let status: DataStudioStageValidationResult["status"];
  if (!enabled) {
    status = stage.activation.mode === "disabled" ? "disabled" : "skipped";
  } else if (blockingIssueCount > 0) {
    status = "blocked";
  } else if (warningIssueCount > 0) {
    status = "ready-with-warnings";
  } else {
    status = "ready";
  }

  return Object.freeze({
    stageId: stage.stageId,
    ready: enabled ? blockingIssueCount === 0 : true,
    status,
    blockingIssueCount,
    warningIssueCount,
    issues,
  });
}

function enabledStagesInOrder(
  stages: ReadonlyArray<DataStudioPipelineStageState>,
): ReadonlyArray<DataStudioPipelineStageState> {
  return Object.freeze(
    [...stages]
      .filter((stage) => isStageEnabled(stage))
      .sort((left, right) => left.order - right.order),
  );
}

const RequiredStageIds = Object.freeze([
  PipelineStageIds.SourceSelection,
  PipelineStageIds.UnifiedIngestion,
  PipelineStageIds.StoragePrepared,
] as const);

const DownstreamPreparationStageIds = Object.freeze([
  PipelineStageIds.Profiling,
  PipelineStageIds.Classification,
  PipelineStageIds.Normalization,
  PipelineStageIds.Cleaning,
  PipelineStageIds.Transformation,
  PipelineStageIds.Enrichment,
  PipelineStageIds.FeatureEngineering,
  PipelineStageIds.Extraction,
  PipelineStageIds.Chunking,
  PipelineStageIds.Aggregation,
  PipelineStageIds.Labeling,
  PipelineStageIds.StoragePrepared,
] as const);

const PreparedOutputCandidateStageIds = Object.freeze([
  PipelineStageIds.Transformation,
  PipelineStageIds.Enrichment,
  PipelineStageIds.FeatureEngineering,
  PipelineStageIds.Aggregation,
  PipelineStageIds.Labeling,
  PipelineStageIds.Chunking,
  PipelineStageIds.Extraction,
  PipelineStageIds.Cleaning,
  PipelineStageIds.Normalization,
] as const);

export class DataStudioPipelineValidationService {
  private readonly stageRegistry: PipelineStageRegistry;

  constructor(stageRegistry: PipelineStageRegistry = new PipelineStageRegistry()) {
    this.stageRegistry = stageRegistry;
  }

  public validate(
    state: DataStudioPipelineState,
    request: DataStudioPipelineValidationRequest = {},
  ): DataStudioPipelineValidationResult {
    const issues: DataStudioPipelineValidationIssue[] = [];
    const stagesById = new Map(state.stages.map((stage) => [stage.stageId, stage]));
    const orders = stageOrderMap(state.stages);

    for (const requiredStageId of RequiredStageIds) {
      const requiredStage = stagesById.get(requiredStageId);
      if (!requiredStage) {
        issues.push(createIssue({
          code: "data-pipeline.required-stage.missing",
          message: `Required stage '${requiredStageId}' is missing from pipeline state.`,
          scope: DataStudioPipelineValidationScopes.pipeline,
          stageId: requiredStageId,
        }));
        continue;
      }
      if (!isStageEnabled(requiredStage)) {
        issues.push(createIssue({
          code: "data-pipeline.required-stage.disabled",
          message: `Required stage '${requiredStageId}' cannot be disabled.`,
          scope: DataStudioPipelineValidationScopes.stage,
          stageId: requiredStageId,
          path: `stages.${requiredStageId}.enabled`,
        }));
      }
    }

    this.validateStageConfiguration(state, stagesById, issues);
    this.validateOrderingConstraints(stagesById, orders, issues);
    this.validateCrossStageDependencies(stagesById, orders, issues);
    this.validateTransitions(state, stagesById, orders, issues);
    this.validateGraphConsistency(state, stagesById, issues);

    if (request.transition) {
      this.validateTransitionRequest(state, request.transition, stagesById, orders, issues);
    }

    const dedupedIssues = dedupeIssues(issues);
    const stageResults = Object.freeze(
      state.stages
        .map((stage) => {
          const scopedIssues = dedupedIssues.filter((issue) => issue.stageId === stage.stageId);
          return toStageResult(stage, Object.freeze(scopedIssues));
        })
        .sort((left, right) => {
          const leftOrder = stagesById.get(left.stageId)?.order ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = stagesById.get(right.stageId)?.order ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder;
        }),
    );

    const blockingIssues = Object.freeze(dedupedIssues.filter((issue) => issue.blocking));
    const warningIssues = Object.freeze(dedupedIssues.filter((issue) => !issue.blocking));
    const executionBlockingCodes = new Set([
      "data-pipeline.required-stage.missing",
      "data-pipeline.required-stage.disabled",
      "data-pipeline.source-selection.missing-reference",
      "data-pipeline.ingestion.missing-output-target",
      "data-pipeline.ingestion.missing-prerequisite",
      "data-pipeline.chunking.requires-extraction",
      "data-pipeline.prepared-storage.missing-destination",
      "data-pipeline.prepared-storage.missing-upstream-output",
      "data-pipeline.transition.backward-not-allowed",
      "data-pipeline.transition.sequence-invalid",
      "data-pipeline.ordering.before-constraint-violated",
      "data-pipeline.ordering.after-constraint-violated",
    ]);
    const executionReady = blockingIssues.every((issue) => !executionBlockingCodes.has(issue.code));
    const ready = blockingIssues.length === 0;

    return Object.freeze({
      ready,
      executionReady,
      issues: dedupedIssues,
      blockingIssues,
      warningIssues,
      stageResults,
      summary: Object.freeze({
        ready,
        executionReady,
        blockingIssueCount: blockingIssues.length,
        warningIssueCount: warningIssues.length,
      }),
    });
  }

  private validateStageConfiguration(
    state: DataStudioPipelineState,
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    const sourceSelection = stagesById.get(PipelineStageIds.SourceSelection);
    if (isStageEnabled(sourceSelection)) {
      const hasSourceReference = hasNonEmptyString(sourceSelection?.options.sourceReference)
        || hasNonEmptyString(sourceSelection?.options.sourceAssetId);
      if (!hasSourceReference) {
        issues.push(createIssue({
          code: "data-pipeline.source-selection.missing-reference",
          message: "Source Selection requires sourceReference or sourceAssetId before ingestion can execute.",
          scope: DataStudioPipelineValidationScopes.stage,
          stageId: PipelineStageIds.SourceSelection,
          path: "stages.SourceSelection.options.sourceReference",
        }));
      }
    }

    const ingestion = stagesById.get(PipelineStageIds.UnifiedIngestion);
    if (isStageEnabled(ingestion) && !hasNonEmptyString(ingestion?.options.outputTarget)) {
      issues.push(createIssue({
        code: "data-pipeline.ingestion.missing-output-target",
        message: "Unified Ingestion requires outputTarget configuration.",
        scope: DataStudioPipelineValidationScopes.stage,
        stageId: PipelineStageIds.UnifiedIngestion,
        path: "stages.UnifiedIngestion.options.outputTarget",
      }));
    }

    const chunking = stagesById.get(PipelineStageIds.Chunking);
    if (isStageEnabled(chunking) && chunking?.options.chunkSize !== undefined && !hasPositiveNumber(chunking.options.chunkSize)) {
      issues.push(createIssue({
        code: "data-pipeline.chunking.invalid-chunk-size",
        message: "Chunking chunkSize must be a positive number when configured.",
        scope: DataStudioPipelineValidationScopes.stage,
        stageId: PipelineStageIds.Chunking,
        path: "stages.Chunking.options.chunkSize",
      }));
    }

    const aggregation = stagesById.get(PipelineStageIds.Aggregation);
    if (isStageEnabled(aggregation)) {
      const groupBy = aggregation?.options.groupByFields;
      const hasGroupBy = Array.isArray(groupBy)
        ? groupBy.some((value) => hasNonEmptyString(value))
        : hasNonEmptyString(groupBy);
      if (!hasGroupBy) {
        issues.push(createIssue({
          code: "data-pipeline.aggregation.missing-group-by",
          message: "Aggregation should define at least one groupBy field to avoid ambiguous output semantics.",
          severity: "warning",
          scope: DataStudioPipelineValidationScopes.stage,
          stageId: PipelineStageIds.Aggregation,
          path: "stages.Aggregation.options.groupByFields",
        }));
      }
    }

    const preparedStorage = stagesById.get(PipelineStageIds.StoragePrepared);
    const hasPreparedDestination = hasNonEmptyString(preparedStorage?.options.destination)
      || hasNonEmptyString(state.unifiedPreparationAsset.storageTarget?.targetId)
      || hasNonEmptyString(state.preparedDatasetLineage.output.storageTargetId);
    if (isStageEnabled(preparedStorage) && !hasPreparedDestination) {
      issues.push(createIssue({
        code: "data-pipeline.prepared-storage.missing-destination",
        message: "Prepared Storage requires a destination target before pipeline execution.",
        scope: DataStudioPipelineValidationScopes.stage,
        stageId: PipelineStageIds.StoragePrepared,
        path: "stages.StoragePrepared.options.destination",
      }));
    }

    for (const stage of state.stages) {
      if (!isStageEnabled(stage) && stage.status === "current") {
        issues.push(createIssue({
          code: "data-pipeline.stage-status.invalid-current",
          message: `Disabled or skipped stage '${stage.stageId}' cannot be marked as current.`,
          severity: "warning",
          scope: DataStudioPipelineValidationScopes.stage,
          stageId: stage.stageId,
          path: `stages.${stage.stageId}.status`,
        }));
      }
      if (!isStageEnabled(stage) && stage.status === "completed") {
        issues.push(createIssue({
          code: "data-pipeline.stage-status.disabled-completed",
          message: `Stage '${stage.stageId}' is disabled but marked completed; state may be stale.`,
          severity: "warning",
          scope: DataStudioPipelineValidationScopes.stage,
          stageId: stage.stageId,
          path: `stages.${stage.stageId}.status`,
        }));
      }
    }
  }

  private validateOrderingConstraints(
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    orders: ReadonlyMap<PipelineStageId, number>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    for (const stageDefinition of this.stageRegistry.listDefinitions()) {
      const stage = stagesById.get(stageDefinition.id);
      if (!isStageEnabled(stage)) {
        continue;
      }
      const stageOrder = orders.get(stageDefinition.id) ?? Number.MAX_SAFE_INTEGER;

      for (const beforeStageId of stageDefinition.orderingConstraints.before ?? []) {
        const beforeStage = stagesById.get(beforeStageId);
        if (!isStageEnabled(beforeStage)) {
          continue;
        }
        const beforeOrder = orders.get(beforeStageId) ?? Number.MAX_SAFE_INTEGER;
        if (stageOrder >= beforeOrder) {
          issues.push(createIssue({
            code: "data-pipeline.ordering.before-constraint-violated",
            message: `Stage '${stageDefinition.id}' must be ordered before '${beforeStageId}'.`,
            scope: DataStudioPipelineValidationScopes.pipeline,
            stageId: stageDefinition.id,
            relatedStageIds: Object.freeze([beforeStageId]),
          }));
        }
      }

      for (const afterStageId of stageDefinition.orderingConstraints.after ?? []) {
        const afterStage = stagesById.get(afterStageId);
        if (!isStageEnabled(afterStage)) {
          continue;
        }
        const afterOrder = orders.get(afterStageId) ?? Number.MIN_SAFE_INTEGER;
        if (stageOrder <= afterOrder) {
          issues.push(createIssue({
            code: "data-pipeline.ordering.after-constraint-violated",
            message: `Stage '${stageDefinition.id}' must be ordered after '${afterStageId}'.`,
            scope: DataStudioPipelineValidationScopes.pipeline,
            stageId: stageDefinition.id,
            relatedStageIds: Object.freeze([afterStageId]),
          }));
        }
      }
    }
  }

  private validateCrossStageDependencies(
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    orders: ReadonlyMap<PipelineStageId, number>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    const sourceSelection = stagesById.get(PipelineStageIds.SourceSelection);
    const ingestion = stagesById.get(PipelineStageIds.UnifiedIngestion);
    if (isStageEnabled(ingestion) && !isStageEnabled(sourceSelection)) {
      issues.push(createIssue({
        code: "data-pipeline.ingestion.missing-prerequisite",
        message: "Unified Ingestion requires Source Selection.",
        scope: DataStudioPipelineValidationScopes.pipeline,
        stageId: PipelineStageIds.UnifiedIngestion,
        relatedStageIds: Object.freeze([PipelineStageIds.SourceSelection]),
      }));
    }

    for (const downstreamId of DownstreamPreparationStageIds) {
      if (downstreamId === PipelineStageIds.UnifiedIngestion) {
        continue;
      }
      const stage = stagesById.get(downstreamId);
      if (!isStageEnabled(stage)) {
        continue;
      }
      if (!isStageEnabled(ingestion)) {
        issues.push(createIssue({
          code: "data-pipeline.downstream.missing-ingestion",
          message: `Stage '${downstreamId}' requires Unified Ingestion to be enabled first.`,
          scope: DataStudioPipelineValidationScopes.pipeline,
          stageId: downstreamId,
          relatedStageIds: Object.freeze([PipelineStageIds.UnifiedIngestion]),
        }));
      }
      const ingestionOrder = orders.get(PipelineStageIds.UnifiedIngestion) ?? Number.MIN_SAFE_INTEGER;
      const stageOrder = orders.get(downstreamId) ?? Number.MAX_SAFE_INTEGER;
      if (stageOrder <= ingestionOrder) {
        issues.push(createIssue({
          code: "data-pipeline.downstream.invalid-sequencing",
          message: `Stage '${downstreamId}' must be ordered after Unified Ingestion.`,
          scope: DataStudioPipelineValidationScopes.pipeline,
          stageId: downstreamId,
          relatedStageIds: Object.freeze([PipelineStageIds.UnifiedIngestion]),
        }));
      }
    }

    const extraction = stagesById.get(PipelineStageIds.Extraction);
    const chunking = stagesById.get(PipelineStageIds.Chunking);
    if (isStageEnabled(chunking) && !isStageEnabled(extraction)) {
      issues.push(createIssue({
        code: "data-pipeline.chunking.requires-extraction",
        message: "Chunking requires Extraction when text chunks depend on extracted text.",
        scope: DataStudioPipelineValidationScopes.pipeline,
        stageId: PipelineStageIds.Chunking,
        relatedStageIds: Object.freeze([PipelineStageIds.Extraction]),
      }));
    }

    const preparedStorage = stagesById.get(PipelineStageIds.StoragePrepared);
    if (isStageEnabled(preparedStorage)) {
      const hasAnyPreparationStage = PreparedOutputCandidateStageIds.some((stageId) => isStageEnabled(stagesById.get(stageId)));
      if (!hasAnyPreparationStage) {
        issues.push(createIssue({
          code: "data-pipeline.prepared-storage.missing-upstream-output",
          message: "Prepared Storage requires at least one upstream preparation stage output.",
          scope: DataStudioPipelineValidationScopes.pipeline,
          stageId: PipelineStageIds.StoragePrepared,
        }));
      }
    }
  }

  private validateTransitions(
    state: DataStudioPipelineState,
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    orders: ReadonlyMap<PipelineStageId, number>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    if (state.transitions.length === 0) {
      issues.push(createIssue({
        code: "data-pipeline.transitions.empty",
        message: "Pipeline transitions are empty; canvas graph sequencing may be incomplete.",
        severity: "warning",
        scope: DataStudioPipelineValidationScopes.transition,
      }));
      return;
    }

    for (const transition of state.transitions) {
      const fromStage = stagesById.get(transition.fromStageId);
      const toStage = stagesById.get(transition.toStageId);
      if (!fromStage || !toStage) {
        issues.push(createIssue({
          code: "data-pipeline.transition.unknown-stage",
          message: `Transition '${transition.fromStageId}' -> '${transition.toStageId}' references an unknown stage.`,
          scope: DataStudioPipelineValidationScopes.transition,
          stageId: fromStage ? transition.fromStageId : transition.toStageId,
          relatedStageIds: Object.freeze([transition.fromStageId, transition.toStageId]),
        }));
        continue;
      }
      const fromOrder = orders.get(transition.fromStageId) ?? Number.MIN_SAFE_INTEGER;
      const toOrder = orders.get(transition.toStageId) ?? Number.MAX_SAFE_INTEGER;
      if (toOrder <= fromOrder) {
        issues.push(createIssue({
          code: "data-pipeline.transition.backward-not-allowed",
          message: `Transition '${transition.fromStageId}' -> '${transition.toStageId}' violates forward stage ordering.`,
          scope: DataStudioPipelineValidationScopes.transition,
          stageId: transition.toStageId,
          relatedStageIds: Object.freeze([transition.fromStageId]),
        }));
      }
    }

    const enabledStages = enabledStagesInOrder(state.stages);
    for (let index = 0; index < enabledStages.length - 1; index += 1) {
      const current = enabledStages[index];
      const next = enabledStages[index + 1];
      if (!current || !next) {
        continue;
      }
      const hasTransition = this.hasForwardTransitionPath(
        current.stageId,
        next.stageId,
        state.transitions,
        orders,
      );
      if (!hasTransition) {
        issues.push(createIssue({
          code: "data-pipeline.transition.sequence-invalid",
          message: `Enabled stage sequence is missing transition '${current.stageId}' -> '${next.stageId}'.`,
          scope: DataStudioPipelineValidationScopes.transition,
          stageId: next.stageId,
          relatedStageIds: Object.freeze([current.stageId]),
        }));
      }
    }
  }

  private hasForwardTransitionPath(
    fromStageId: PipelineStageId,
    toStageId: PipelineStageId,
    transitions: ReadonlyArray<DataStudioPipelineState["transitions"][number]>,
    orders: ReadonlyMap<PipelineStageId, number>,
  ): boolean {
    if (fromStageId === toStageId) {
      return true;
    }
    const queue: PipelineStageId[] = [fromStageId];
    const visited = new Set<PipelineStageId>([fromStageId]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      for (const transition of transitions) {
        if (transition.fromStageId !== current) {
          continue;
        }
        const next = transition.toStageId;
        if (next === toStageId) {
          return true;
        }
        const currentOrder = orders.get(current) ?? Number.MIN_SAFE_INTEGER;
        const nextOrder = orders.get(next) ?? Number.MAX_SAFE_INTEGER;
        if (nextOrder <= currentOrder || visited.has(next)) {
          continue;
        }
        visited.add(next);
        queue.push(next);
      }
    }
    return false;
  }

  private validateGraphConsistency(
    state: DataStudioPipelineState,
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    const groupIds = new Set(state.authoringGraph.groups.map((group) => group.id));
    for (const stage of state.stages) {
      if (!isStageEnabled(stage)) {
        continue;
      }
      const expectedGroupId = `group:${stage.stageId}`;
      if (!groupIds.has(expectedGroupId)) {
        issues.push(createIssue({
          code: "data-pipeline.graph.missing-stage-group",
          message: `Authoring graph is missing group '${expectedGroupId}' for enabled stage '${stage.stageId}'.`,
          severity: "warning",
          scope: DataStudioPipelineValidationScopes.graph,
          stageId: stage.stageId,
        }));
      }
    }

    if (state.authoringGraph.nodes.length < stagesById.size) {
      issues.push(createIssue({
        code: "data-pipeline.graph.node-count-low",
        message: "Authoring graph node count is lower than pipeline stage count; canvas projection may be stale.",
        severity: "warning",
        scope: DataStudioPipelineValidationScopes.graph,
      }));
    }
  }

  private validateTransitionRequest(
    state: DataStudioPipelineState,
    transition: DataStudioPipelineTransitionValidationRequest,
    stagesById: ReadonlyMap<PipelineStageId, DataStudioPipelineStageState>,
    orders: ReadonlyMap<PipelineStageId, number>,
    issues: DataStudioPipelineValidationIssue[],
  ): void {
    const fromStage = stagesById.get(transition.fromStageId);
    const toStage = stagesById.get(transition.toStageId);
    if (!fromStage || !toStage) {
      issues.push(createIssue({
        code: "data-pipeline.transition.request.unknown-stage",
        message: `Requested transition '${transition.fromStageId}' -> '${transition.toStageId}' references an unknown stage.`,
        scope: DataStudioPipelineValidationScopes.transition,
        stageId: transition.toStageId,
      }));
      return;
    }

    const fromOrder = orders.get(transition.fromStageId) ?? Number.MIN_SAFE_INTEGER;
    const toOrder = orders.get(transition.toStageId) ?? Number.MAX_SAFE_INTEGER;
    if (toOrder <= fromOrder) {
      issues.push(createIssue({
        code: "data-pipeline.transition.backward-not-allowed",
        message: `Cannot transition from '${transition.fromStageId}' to '${transition.toStageId}' because stage order must progress forward.`,
        scope: DataStudioPipelineValidationScopes.transition,
        stageId: transition.toStageId,
      }));
    }

    const completed = new Set(state.flow.completedStageIds);
    for (const stage of enabledStagesInOrder(state.stages)) {
      if ((orders.get(stage.stageId) ?? Number.MAX_SAFE_INTEGER) >= toOrder) {
        continue;
      }
      if (stage.stageId === transition.fromStageId) {
        continue;
      }
      if (!completed.has(stage.stageId)) {
        issues.push(createIssue({
          code: "data-pipeline.transition.prerequisite-incomplete",
          message: `Stage '${stage.stageId}' must be completed before moving to '${transition.toStageId}'.`,
          scope: DataStudioPipelineValidationScopes.transition,
          stageId: transition.toStageId,
          relatedStageIds: Object.freeze([stage.stageId]),
        }));
      }
    }
  }
}

