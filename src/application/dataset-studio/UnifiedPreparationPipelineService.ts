import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineDefinition } from "../../domain/dataset-studio/PipelineDefinitionDomain";
import type { PipelineGraph } from "../../domain/dataset-studio/PipelineGraphDomain";
import {
  PipelineStageConfigModes,
  PipelineStageIds,
  createPipelineStageInstance,
  type PipelineStageConfigMode,
  type PipelineStageId,
  type PipelineStageInstance,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  UnifiedPreparationStageActivationModes,
  createUnifiedPreparationAssetDefinition,
  type UnifiedPreparationAssetDefinition,
  type UnifiedPreparationStageConfig,
} from "../../domain/dataset-studio/UnifiedPreparationAsset";
import type { StudioAuthoringGraphProjection } from "../studio-shell/StudioAuthoringGraph";
import { buildPipelineGraph, type PipelineGraphTransition } from "./PipelineGraphConstructionService";
import { PipelineValidationService } from "./PipelineValidationService";
import { StageAssetCompositionService, type StageCompositionDefinition } from "./StageAssetCompositionService";

export interface PreparationStageGroupMapping {
  readonly stageId: PipelineStageId;
  readonly groupIds: ReadonlyArray<string>;
}

export interface PreparationStageDescriptor {
  readonly stageId: PipelineStageId;
  readonly order: number;
  readonly label: string;
  readonly description: string;
  readonly optional: boolean;
  readonly visibility: "simple" | "advanced";
  readonly activationMode: "always" | "conditional" | "disabled";
  readonly conditionId?: string;
  readonly assetGroupIds: ReadonlyArray<string>;
}

export interface UnifiedPreparationPipelineResolution {
  readonly asset: UnifiedPreparationAssetDefinition;
  readonly stageDescriptors: ReadonlyArray<PreparationStageDescriptor>;
  readonly stageGroupMappings: ReadonlyArray<PreparationStageGroupMapping>;
  readonly pipelineDefinition: PipelineDefinition;
  readonly transitions: ReadonlyArray<PipelineGraphTransition>;
  readonly graph: PipelineGraph;
  readonly authoringGraph: StudioAuthoringGraphProjection;
}

const RequiredStageOrder = Object.freeze([
  PipelineStageIds.SourceSelection,
  PipelineStageIds.UnifiedIngestion,
  PipelineStageIds.StoragePrepared,
] as const);

const KnownEpic17PipelineAssetIds = Object.freeze([
  "pipeline.tabular-cleaning.v1",
  "pipeline.document-preparation.v1",
  "pipeline.image-preparation.v1",
]);
const KnownEpic17PipelineAssetIdSet = new Set<string>(KnownEpic17PipelineAssetIds);

function normalizeStageConfigMode(mode: PipelineStageConfigMode | undefined): PipelineStageConfigMode {
  return mode ?? PipelineStageConfigModes.simple;
}

function toPipelineStageConfigOptions(
  options: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...options });
}

function toEnabledState(stage: UnifiedPreparationStageConfig): boolean {
  return stage.activation.mode !== UnifiedPreparationStageActivationModes.disabled;
}

function resolveTransitions(
  orderedStageIds: ReadonlyArray<PipelineStageId>,
): ReadonlyArray<PipelineGraphTransition> {
  return Object.freeze(
    orderedStageIds.slice(0, -1).map((stageId, index) => {
      const next = orderedStageIds[index + 1];
      if (!next) {
        throw new Error(`Unable to determine next stage after '${stageId}'.`);
      }
      return Object.freeze({
        fromStageId: stageId,
        toStageId: next,
      });
    }),
  );
}

export class UnifiedPreparationPipelineService {
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly stageCompositionService: StageAssetCompositionService;
  private readonly validationService: PipelineValidationService;

  constructor(input?: {
    readonly stageRegistry?: PipelineStageRegistry;
    readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    this.stageCompositionService = new StageAssetCompositionService(input?.stageCompositions);
    this.validationService = new PipelineValidationService({
      stageRegistry: this.stageRegistry,
      stageCompositions: input?.stageCompositions,
    });
  }

  public resolve(
    definition: UnifiedPreparationAssetDefinition,
  ): UnifiedPreparationPipelineResolution {
    const asset = createUnifiedPreparationAssetDefinition(definition);
    this.assertUpstreamBindingCompatibility(asset);

    const requestedStageConfigById = new Map(asset.stages.map((stage) => [stage.stageId, stage]));
    const stageInstances: PipelineStageInstance[] = [];
    const stageDescriptors: PreparationStageDescriptor[] = [];
    const stageGroupMappings: PreparationStageGroupMapping[] = [];

    for (const stageDefinition of this.stageRegistry.listDefinitions()) {
      const requested = requestedStageConfigById.get(stageDefinition.id);
      if (!requested) {
        continue;
      }

      const instance = createPipelineStageInstance({
        definition: stageDefinition,
        enabled: toEnabledState(requested),
        config: {
          mode: normalizeStageConfigMode(requested.configMode),
          options: toPipelineStageConfigOptions(requested.options),
        },
      });
      stageInstances.push(instance);

      const composition = this.stageCompositionService.getDefinition(stageDefinition.id);
      const groupIds = Object.freeze(composition.groups.map((group) => group.id));
      stageGroupMappings.push(Object.freeze({
        stageId: stageDefinition.id,
        groupIds,
      }));
      stageDescriptors.push(Object.freeze({
        stageId: stageDefinition.id,
        order: stageInstances.length,
        label: stageDefinition.displayName,
        description: stageDefinition.description,
        optional: stageDefinition.isOptional,
        visibility: requested.visibility,
        activationMode: requested.activation.mode,
        conditionId: requested.activation.conditionId,
        assetGroupIds: groupIds,
      }));
    }

    this.assertRequiredStagesEnabled(stageInstances);
    if (stageInstances.length === 0) {
      throw new Error("Unified preparation asset resolved no stage instances.");
    }

    const orderedStageIds = stageInstances
      .filter((stage) => stage.enabled)
      .map((stage) => stage.stageId);
    const transitions = resolveTransitions(orderedStageIds);

    const pipelineDefinition: PipelineDefinition = Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions,
    });

    this.validationService.validate({
      definition: pipelineDefinition,
      context: "default",
    });

    const graph = buildPipelineGraph({
      stageInstances: pipelineDefinition.stageInstances,
      transitions,
      stageRegistry: this.stageRegistry,
      stageCompositions: this.stageCompositionService.listDefinitions(),
    });

    const authoringGraph = this.toAuthoringGraph(graph);

    return Object.freeze({
      asset,
      stageDescriptors: Object.freeze(stageDescriptors),
      stageGroupMappings: Object.freeze(stageGroupMappings),
      pipelineDefinition,
      transitions,
      graph,
      authoringGraph,
    });
  }

  private assertRequiredStagesEnabled(stageInstances: ReadonlyArray<PipelineStageInstance>): void {
    const byId = new Map(stageInstances.map((stage) => [stage.stageId, stage]));
    for (const requiredStageId of RequiredStageOrder) {
      const stage = byId.get(requiredStageId);
      if (!stage) {
        throw new Error(`Unified preparation pipeline is missing required stage '${requiredStageId}'.`);
      }
      if (!stage.enabled) {
        throw new Error(`Unified preparation pipeline cannot disable required stage '${requiredStageId}'.`);
      }
    }
  }

  private assertUpstreamBindingCompatibility(asset: UnifiedPreparationAssetDefinition): void {
    for (const binding of asset.upstreamBindings) {
      if (!KnownEpic17PipelineAssetIdSet.has(binding.pipelineAssetId)) {
        throw new Error(
          `Unified preparation upstream binding '${binding.pipelineAssetId}' is not an Epic 17 pipeline reference.`,
        );
      }
      if (binding.outputStageId && !this.stageRegistry.has(binding.outputStageId)) {
        throw new Error(
          `Unified preparation upstream binding stage '${binding.outputStageId}' is not registered.`,
        );
      }
    }
  }

  private toAuthoringGraph(graph: PipelineGraph): StudioAuthoringGraphProjection {
    const stageGroups = graph.nodes
      .filter((node) => node.kind === "stage")
      .map((node) => Object.freeze({
        id: `group:${node.data.stageId}`,
        title: node.data.label,
        order: node.data.stageOrder,
        nodeIds: Object.freeze(
          graph.nodes
            .filter((candidate) => candidate.data.stageId === node.data.stageId)
            .map((candidate) => candidate.id),
        ),
      }))
      .sort((left, right) => left.order - right.order);

    return Object.freeze({
      source: "pipeline",
      nodes: Object.freeze(
        graph.nodes.map((node) => Object.freeze({
          id: node.id,
          kind: node.kind,
          label: node.kind === "stage" ? node.data.label : node.data.assetId,
          groupId: `group:${node.data.stageId}`,
          metadata: Object.freeze({
            stageId: node.data.stageId,
          }),
        })),
      ),
      edges: Object.freeze(
        graph.edges.map((edge) => Object.freeze({
          id: edge.id,
          kind: edge.kind,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          metadata: Object.freeze({
            sourceStageId: edge.sourceStageId,
            targetStageId: edge.targetStageId,
            compatibilityTypes: edge.compatibilityTypes,
          }),
        })),
      ),
      groups: Object.freeze(stageGroups),
    });
  }
}

export function createUnifiedPreparationPipelineService(input?: {
  readonly stageRegistry?: PipelineStageRegistry;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
}): UnifiedPreparationPipelineService {
  return new UnifiedPreparationPipelineService(input);
}
