import type { CanonicalDataShapeKind } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  PipelineGraphEdgeKinds,
  PipelineGraphNodeKinds,
  validatePipelineGraph,
  type PipelineGraph,
  type PipelineGraphEdge,
  type PipelineGraphNode,
} from "../../domain/dataset-studio/PipelineGraphDomain";
import type {
  PipelineStageDefinition,
  PipelineStageId,
  PipelineStageInstance,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  StageAssetCompositionService,
  type StageCompositionDefinition,
} from "./StageAssetCompositionService";

export interface PipelineGraphTransition {
  readonly fromStageId: PipelineStageId;
  readonly toStageId: PipelineStageId;
}

export interface BuildPipelineGraphInput {
  readonly stageInstances: ReadonlyArray<PipelineStageInstance>;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  readonly stageRegistry?: PipelineStageRegistry;
  readonly transitions?: ReadonlyArray<PipelineGraphTransition>;
  readonly explicitBranchingStageIds?: ReadonlyArray<PipelineStageId>;
}

function listConfiguredTypes(
  stage: PipelineStageDefinition,
  instance: PipelineStageInstance,
): {
  readonly inputTypes: ReadonlyArray<CanonicalDataShapeKind>;
  readonly outputTypes: ReadonlyArray<CanonicalDataShapeKind>;
} {
  const inputTypes = instance.config.declaredInputType
    ? [instance.config.declaredInputType]
    : stage.allowedInputTypes;

  const outputTypes = instance.config.expectedOutputType
    ? [instance.config.expectedOutputType]
    : stage.producedOutputTypes;

  return Object.freeze({
    inputTypes: Object.freeze(inputTypes),
    outputTypes: Object.freeze(outputTypes),
  });
}

function resolveCompatibilityTypes(
  leftStage: PipelineStageDefinition,
  leftInstance: PipelineStageInstance,
  rightStage: PipelineStageDefinition,
  rightInstance: PipelineStageInstance,
): ReadonlyArray<CanonicalDataShapeKind> {
  const leftTypes = listConfiguredTypes(leftStage, leftInstance);
  const rightTypes = listConfiguredTypes(rightStage, rightInstance);

  return Object.freeze(
    leftTypes.outputTypes.filter((candidate) => rightTypes.inputTypes.includes(candidate)),
  );
}

function assertValidAdjacency(
  leftStage: PipelineStageDefinition,
  leftInstance: PipelineStageInstance,
  rightStage: PipelineStageDefinition,
  rightInstance: PipelineStageInstance,
): ReadonlyArray<CanonicalDataShapeKind> {
  if (leftStage.orderingConstraints.after?.includes(rightStage.id)) {
    throw new Error(
      `Invalid stage adjacency '${leftStage.id} -> ${rightStage.id}': '${leftStage.id}' must run after '${rightStage.id}'.`,
    );
  }

  if (rightStage.orderingConstraints.before?.includes(leftStage.id)) {
    throw new Error(
      `Invalid stage adjacency '${leftStage.id} -> ${rightStage.id}': '${rightStage.id}' must run before '${leftStage.id}'.`,
    );
  }

  const compatibilityTypes = resolveCompatibilityTypes(leftStage, leftInstance, rightStage, rightInstance);
  if (compatibilityTypes.length === 0) {
    throw new Error(
      `Invalid stage adjacency '${leftStage.id} -> ${rightStage.id}': no compatible output/input data shapes.`,
    );
  }

  return compatibilityTypes;
}

function createDeterministicStageOrder(
  enabledStageIds: ReadonlyArray<PipelineStageId>,
  stageById: ReadonlyMap<PipelineStageId, PipelineStageDefinition>,
  stageInstanceOrder: ReadonlyMap<PipelineStageId, number>,
): ReadonlyArray<PipelineStageId> {
  const enabledSet = new Set(enabledStageIds);
  const incoming = new Map<PipelineStageId, number>();
  const outgoing = new Map<PipelineStageId, Set<PipelineStageId>>();

  for (const stageId of enabledSet) {
    incoming.set(stageId, 0);
    outgoing.set(stageId, new Set<PipelineStageId>());
  }

  const addDirectedEdge = (fromStageId: PipelineStageId, toStageId: PipelineStageId): void => {
    if (!enabledSet.has(fromStageId) || !enabledSet.has(toStageId)) {
      return;
    }

    const stageTargets = outgoing.get(fromStageId);
    if (!stageTargets || stageTargets.has(toStageId)) {
      return;
    }

    stageTargets.add(toStageId);
    incoming.set(toStageId, (incoming.get(toStageId) ?? 0) + 1);
  };

  for (const stageId of enabledSet) {
    const stage = stageById.get(stageId);
    if (!stage) {
      continue;
    }

    for (const constrainedAfterId of stage.orderingConstraints.after ?? []) {
      addDirectedEdge(constrainedAfterId, stageId);
    }
    for (const constrainedBeforeId of stage.orderingConstraints.before ?? []) {
      addDirectedEdge(stageId, constrainedBeforeId);
    }
  }

  const sortStageIds = (left: PipelineStageId, right: PipelineStageId): number => {
    const leftInstanceOrder = stageInstanceOrder.get(left);
    const rightInstanceOrder = stageInstanceOrder.get(right);

    if (leftInstanceOrder !== undefined && rightInstanceOrder !== undefined) {
      return leftInstanceOrder - rightInstanceOrder;
    }
    if (leftInstanceOrder !== undefined) {
      return -1;
    }
    if (rightInstanceOrder !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  };

  const queue = [...enabledSet]
    .filter((stageId) => (incoming.get(stageId) ?? 0) === 0)
    .sort(sortStageIds);

  const ordered: PipelineStageId[] = [];
  while (queue.length > 0) {
    const stageId = queue.shift();
    if (!stageId) {
      break;
    }

    ordered.push(stageId);

    const neighbours = outgoing.get(stageId);
    if (!neighbours) {
      continue;
    }

    for (const neighbourId of neighbours) {
      const nextIncoming = (incoming.get(neighbourId) ?? 0) - 1;
      incoming.set(neighbourId, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(neighbourId);
      }
    }

    queue.sort(sortStageIds);
  }

  if (ordered.length !== enabledSet.size) {
    throw new Error("Pipeline stage ordering constraints contain a cycle for the selected enabled stages.");
  }

  return Object.freeze(ordered);
}

function sanitizeTransitionSet(input: {
  readonly orderedStageIds: ReadonlyArray<PipelineStageId>;
  readonly transitions?: ReadonlyArray<PipelineGraphTransition>;
  readonly explicitBranchingStageIds: ReadonlySet<PipelineStageId>;
}): ReadonlyArray<PipelineGraphTransition> {
  const orderedStageIds = input.orderedStageIds;
  const stageIdSet = new Set(orderedStageIds);
  const stageOrderById = new Map(orderedStageIds.map((stageId, index) => [stageId, index + 1]));

  const rawTransitions = input.transitions
    ? [...input.transitions]
    : orderedStageIds.slice(0, -1).map((stageId, index) => {
      const nextStageId = orderedStageIds[index + 1];
      if (!nextStageId) {
        throw new Error(`Unable to resolve next stage for '${stageId}'.`);
      }
      return Object.freeze({ fromStageId: stageId, toStageId: nextStageId });
    });

  for (const transition of rawTransitions) {
    if (!stageIdSet.has(transition.fromStageId)) {
      throw new Error(`Pipeline transition references unknown source stage '${transition.fromStageId}'.`);
    }
    if (!stageIdSet.has(transition.toStageId)) {
      throw new Error(`Pipeline transition references unknown target stage '${transition.toStageId}'.`);
    }
    if (transition.fromStageId === transition.toStageId) {
      throw new Error(`Pipeline transition '${transition.fromStageId}' cannot target itself.`);
    }

    const fromOrder = stageOrderById.get(transition.fromStageId) ?? 0;
    const toOrder = stageOrderById.get(transition.toStageId) ?? 0;
    if (toOrder <= fromOrder) {
      throw new Error(
        `Pipeline transition '${transition.fromStageId} -> ${transition.toStageId}' violates deterministic stage order.`,
      );
    }
  }

  const outgoingCount = new Map<PipelineStageId, number>();
  for (const transition of rawTransitions) {
    outgoingCount.set(
      transition.fromStageId,
      (outgoingCount.get(transition.fromStageId) ?? 0) + 1,
    );
  }

  for (const [stageId, count] of outgoingCount.entries()) {
    if (count <= 1) {
      continue;
    }
    if (!input.explicitBranchingStageIds.has(stageId)) {
      throw new Error(
        `Stage '${stageId}' branches to multiple downstream stages and must be explicitly allowed for branching.`,
      );
    }
  }

  return Object.freeze(
    rawTransitions
      .map((transition) => Object.freeze({ ...transition }))
      .sort((left, right) => {
        const leftSource = stageOrderById.get(left.fromStageId) ?? 0;
        const rightSource = stageOrderById.get(right.fromStageId) ?? 0;
        if (leftSource !== rightSource) {
          return leftSource - rightSource;
        }
        const leftTarget = stageOrderById.get(left.toStageId) ?? 0;
        const rightTarget = stageOrderById.get(right.toStageId) ?? 0;
        return leftTarget - rightTarget;
      }),
  );
}

export class PipelineGraphConstructionService {
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly compositionService: StageAssetCompositionService;

  constructor(input?: {
    readonly stageRegistry?: PipelineStageRegistry;
    readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    this.compositionService = new StageAssetCompositionService(input?.stageCompositions);
  }

  public build(input: BuildPipelineGraphInput): PipelineGraph {
    const stageRegistry = input.stageRegistry ?? this.stageRegistry;
    const compositionService = input.stageCompositions
      ? new StageAssetCompositionService(input.stageCompositions)
      : this.compositionService;

    const stageInstancesById = new Map<PipelineStageId, PipelineStageInstance>();
    const stageInstanceOrder = new Map<PipelineStageId, number>();

    input.stageInstances.forEach((instance, index) => {
      if (!stageRegistry.has(instance.stageId)) {
        throw new Error(`Pipeline stage '${instance.stageId}' is not registered.`);
      }
      if (stageInstancesById.has(instance.stageId)) {
        throw new Error(`Pipeline stage '${instance.stageId}' is configured multiple times.`);
      }

      const stageDefinition = stageRegistry.getDefinition(instance.stageId);
      if (!stageDefinition.isOptional && !instance.enabled) {
        throw new Error(`Required stage '${instance.stageId}' cannot be disabled.`);
      }

      stageInstancesById.set(instance.stageId, instance);
      stageInstanceOrder.set(instance.stageId, index);
    });

    const enabledStageIds = input.stageInstances
      .filter((instance) => instance.enabled)
      .map((instance) => instance.stageId);

    if (enabledStageIds.length === 0) {
      throw new Error("Pipeline graph requires at least one enabled stage instance.");
    }

    const stageById = new Map<PipelineStageId, PipelineStageDefinition>();
    for (const stageId of enabledStageIds) {
      stageById.set(stageId, stageRegistry.getDefinition(stageId));
    }

    const orderedStageIds = createDeterministicStageOrder(
      enabledStageIds,
      stageById,
      stageInstanceOrder,
    );

    const explicitBranchingStageIds = new Set(input.explicitBranchingStageIds ?? []);
    const transitions = sanitizeTransitionSet({
      orderedStageIds,
      transitions: input.transitions,
      explicitBranchingStageIds,
    });

    const compatibilityByTransitionKey = new Map<string, ReadonlyArray<CanonicalDataShapeKind>>();
    for (const transition of transitions) {
      const sourceStage = stageById.get(transition.fromStageId);
      const sourceInstance = stageInstancesById.get(transition.fromStageId);
      const targetStage = stageById.get(transition.toStageId);
      const targetInstance = stageInstancesById.get(transition.toStageId);
      if (!sourceStage || !sourceInstance || !targetStage || !targetInstance) {
        throw new Error(`Pipeline transition '${transition.fromStageId} -> ${transition.toStageId}' is not fully defined.`);
      }

      const compatibilityTypes = assertValidAdjacency(
        sourceStage,
        sourceInstance,
        targetStage,
        targetInstance,
      );

      compatibilityByTransitionKey.set(
        `${transition.fromStageId}->${transition.toStageId}`,
        compatibilityTypes,
      );
    }

    const stageOrderById = new Map(orderedStageIds.map((stageId, index) => [stageId, index + 1]));

    const nodes: PipelineGraphNode[] = [];
    const edges: PipelineGraphEdge[] = [];
    const finalAssetNodeIdByStageId = new Map<PipelineStageId, string>();

    for (const stageId of orderedStageIds) {
      const stage = stageById.get(stageId);
      const stageInstance = stageInstancesById.get(stageId);
      const stageOrder = stageOrderById.get(stageId);
      if (!stage || !stageInstance || !stageOrder) {
        throw new Error(`Pipeline stage '${stageId}' failed deterministic graph expansion.`);
      }

      const composition = compositionService.resolve({
        stage,
        config: stageInstance.config,
      });

      const stageNodeId = `stage:${stage.id}`;
      nodes.push(Object.freeze({
        id: stageNodeId,
        kind: PipelineGraphNodeKinds.stage,
        data: Object.freeze({
          stageId: stage.id,
          label: stage.displayName,
          description: stage.description,
          category: stage.category,
          stageOrder,
          isOptional: stage.isOptional,
          enabled: stageInstance.enabled,
          supportsPreview: stage.supportsPreview,
          inspectable: composition.inspectable && stageInstance.metadata.inspectable,
          config: stageInstance.config,
          metadata: stageInstance.metadata,
        }),
      }));

      const assetNodeIds: string[] = [];
      let assetOrder = 1;
      for (const group of composition.groups) {
        for (const asset of group.assets) {
          const assetNodeId = `asset:${stage.id}:${group.id}:${asset.assetId}:${assetOrder}`;
          nodes.push(Object.freeze({
            id: assetNodeId,
            kind: PipelineGraphNodeKinds.asset,
            data: Object.freeze({
              stageId: stage.id,
              groupId: group.id,
              assetId: asset.assetId,
              assetVersion: asset.version,
              role: asset.role,
              stageOrder,
              executionOrder: group.executionOrder,
              assetOrder,
              inspectable: composition.inspectable && stageInstance.metadata.inspectable,
              config: asset.config,
            }),
          }));
          assetNodeIds.push(assetNodeId);
          assetOrder += 1;
        }
      }

      if (assetNodeIds.length === 0) {
        throw new Error(`Stage '${stage.id}' produced no asset nodes during graph expansion.`);
      }

      const firstAssetNodeId = assetNodeIds[0];
      if (!firstAssetNodeId) {
        throw new Error(`Stage '${stage.id}' has no first asset node.`);
      }

      edges.push(Object.freeze({
        id: `edge:stage-to-asset:${stageNodeId}->${firstAssetNodeId}`,
        kind: PipelineGraphEdgeKinds.stageToAsset,
        sourceNodeId: stageNodeId,
        targetNodeId: firstAssetNodeId,
        sourceStageId: stage.id,
        targetStageId: stage.id,
        compatibilityTypes: listConfiguredTypes(stage, stageInstance).outputTypes,
      }));

      for (let index = 0; index < assetNodeIds.length - 1; index += 1) {
        const sourceNodeId = assetNodeIds[index];
        const targetNodeId = assetNodeIds[index + 1];
        if (!sourceNodeId || !targetNodeId) {
          continue;
        }

        edges.push(Object.freeze({
          id: `edge:asset-to-asset:${sourceNodeId}->${targetNodeId}`,
          kind: PipelineGraphEdgeKinds.assetToAsset,
          sourceNodeId,
          targetNodeId,
          sourceStageId: stage.id,
          targetStageId: stage.id,
          compatibilityTypes: listConfiguredTypes(stage, stageInstance).outputTypes,
        }));
      }

      finalAssetNodeIdByStageId.set(stage.id, assetNodeIds[assetNodeIds.length - 1] as string);
    }

    for (const transition of transitions) {
      const fromStageNodeId = `stage:${transition.fromStageId}`;
      const toStageNodeId = `stage:${transition.toStageId}`;
      const fromFinalAssetNodeId = finalAssetNodeIdByStageId.get(transition.fromStageId);
      const compatibilityTypes = compatibilityByTransitionKey.get(
        `${transition.fromStageId}->${transition.toStageId}`,
      ) ?? [];

      if (!fromFinalAssetNodeId) {
        throw new Error(`Transition source stage '${transition.fromStageId}' has no final asset node.`);
      }

      edges.push(Object.freeze({
        id: `edge:stage-to-stage:${fromStageNodeId}->${toStageNodeId}`,
        kind: PipelineGraphEdgeKinds.stageToStage,
        sourceNodeId: fromStageNodeId,
        targetNodeId: toStageNodeId,
        sourceStageId: transition.fromStageId,
        targetStageId: transition.toStageId,
        compatibilityTypes,
      }));

      edges.push(Object.freeze({
        id: `edge:asset-to-stage:${fromFinalAssetNodeId}->${toStageNodeId}`,
        kind: PipelineGraphEdgeKinds.assetToStage,
        sourceNodeId: fromFinalAssetNodeId,
        targetNodeId: toStageNodeId,
        sourceStageId: transition.fromStageId,
        targetStageId: transition.toStageId,
        compatibilityTypes,
      }));
    }

    return validatePipelineGraph(
      Object.freeze({
        nodes: Object.freeze(nodes),
        edges: Object.freeze(edges),
      }),
    );
  }
}

export function buildPipelineGraph(input: BuildPipelineGraphInput): PipelineGraph {
  return new PipelineGraphConstructionService({
    stageRegistry: input.stageRegistry,
    stageCompositions: input.stageCompositions,
  }).build(input);
}
