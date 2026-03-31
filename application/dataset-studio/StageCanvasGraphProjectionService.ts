import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { StageFlowDefinition, StageFlowRuntimeState } from "../../domain/dataset-studio/StageFlowDefinition";
import type { DatasetPipelineStageDefinition, DatasetPipelineStageExecutionMode } from "../../domain/dataset-studio/StagePipelineDomain";
import type { PipelineTemplateInstance } from "./TemplateService";
import type { StageRuntimeTracking } from "./StageMetadataContracts";
import { StageAssetMappingService } from "./StageAssetMappingService";
import type { WizardFlowEngine } from "./WizardFlowEngine";
import type {
  UnifiedIngestionOutputTargetKind,
  UnifiedIngestionSourceKind,
  UnifiedIngestionStrategyKind,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";

export type StageCanvasProjectionSource = "wizard" | "template" | "saved";
export type StageCanvasStageStatus = "current" | "completed" | "skipped" | "pending";

export interface StageCanvasStageGroupSummary {
  readonly assetNodeCount: number;
  readonly acceptedInputShapeKinds: ReadonlyArray<string>;
  readonly producedOutputShapeKinds: ReadonlyArray<string>;
  readonly executionMode: DatasetPipelineStageExecutionMode;
  readonly autoConfigured: boolean;
  readonly userOverridden: boolean;
}

export interface StageCanvasStageGroupMetadata {
  readonly stageId: string;
  readonly stageKind: string;
  readonly stageName: string;
  readonly stageDescription: string;
  readonly stageOrder: number;
  readonly stageStatus: StageCanvasStageStatus;
  readonly summary: StageCanvasStageGroupSummary;
  readonly configuration: Readonly<Record<string, CanonicalRecordValue>>;
  readonly output: Readonly<Record<string, CanonicalRecordValue>>;
  readonly runtimeTracking?: StageRuntimeTracking;
}

export interface StageCanvasGroupViewModel {
  readonly id: string;
  readonly stageId: string;
  readonly title: string;
  readonly description: string;
  readonly status: StageCanvasStageStatus;
  readonly metadata: StageCanvasStageGroupMetadata;
  readonly nodeIds: ReadonlyArray<string>;
}

export interface StageCanvasAssetNodeViewModel {
  readonly id: string;
  readonly stageId: string;
  readonly groupId: string;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly title: string;
  readonly subtitle: string;
  readonly metadata: {
    readonly stageOrder: number;
    readonly stageKind: string;
    readonly stageStatus: StageCanvasStageStatus;
    readonly mappingPolicy?: string;
    readonly mappingReason?: string;
    readonly inspectable: boolean;
    readonly inspectionReference?: string;
    readonly summaryReference?: string;
    readonly lineageId?: string;
    readonly pipelineId?: string;
  };
}

export type StageCanvasGraphEdgeKind = "stage-flow" | "conditional-stage-flow";

export interface StageCanvasGraphEdgeViewModel {
  readonly id: string;
  readonly kind: StageCanvasGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceStageId: string;
  readonly targetStageId: string;
  readonly label: string;
  readonly metadata: {
    readonly sourceStageOrder: number;
    readonly targetStageOrder: number;
    readonly conditionalTransitionId?: string;
    readonly conditionId?: string;
  };
}

export interface StageCanvasGraphModel {
  readonly flowId: string;
  readonly flowName: string;
  readonly source: StageCanvasProjectionSource;
  readonly groups: ReadonlyArray<StageCanvasGroupViewModel>;
  readonly nodes: ReadonlyArray<StageCanvasAssetNodeViewModel>;
  readonly edges: ReadonlyArray<StageCanvasGraphEdgeViewModel>;
  readonly metadata: {
    readonly stageCount: number;
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly currentStageId?: string;
    readonly intentId?: string;
    readonly intentTemplateId?: string;
    readonly hasConditionalTransitions: boolean;
  };
}

export interface StageCanvasProjectionRequest {
  readonly source: StageCanvasProjectionSource;
  readonly stageFlow: StageFlowDefinition;
  readonly state?: StageFlowRuntimeState;
  readonly stageRuntimeTracking?: Readonly<Record<string, StageRuntimeTracking>>;
}

function normalizeRecord(
  value: Readonly<Record<string, CanonicalRecordValue>> | undefined,
): Readonly<Record<string, CanonicalRecordValue>> {
  return value ?? Object.freeze({});
}

function dedupeAssetRefs(
  stage: DatasetPipelineStageDefinition,
  mappedAssets: ReadonlyArray<{ readonly assetId: string; readonly assetVersion?: string }>,
): ReadonlyArray<{ readonly assetId: string; readonly assetVersion?: string }> {
  const seen = new Set<string>();
  const merged: Array<{ assetId: string; assetVersion?: string }> = [];
  for (const asset of [...mappedAssets, ...stage.assetReferences]) {
    const key = `${asset.assetId}::${asset.assetVersion ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ assetId: asset.assetId, assetVersion: asset.assetVersion });
  }
  return Object.freeze(merged.map((asset) => Object.freeze(asset)));
}

function resolveStageStatus(
  stageId: string,
  state?: StageFlowRuntimeState,
): StageCanvasStageStatus {
  if (!state) {
    return "pending";
  }
  if (state.currentStageId === stageId) {
    return "current";
  }
  if (state.completedStageIds.includes(stageId)) {
    return "completed";
  }
  if (state.skippedStageIds.includes(stageId)) {
    return "skipped";
  }
  return "pending";
}

function resolveStageMappingHints(
  stageId: string,
  state?: StageFlowRuntimeState,
): {
  readonly detectedSourceKind?: UnifiedIngestionSourceKind;
  readonly strategy?: UnifiedIngestionStrategyKind;
  readonly outputTarget?: UnifiedIngestionOutputTargetKind;
} {
  const stageConfig = state?.stageConfiguration[stageId];
  const stageOutput = state?.stageOutputs[stageId];
  return Object.freeze({
    detectedSourceKind:
      (typeof stageOutput?.detectedSourceKind === "string" ? stageOutput.detectedSourceKind : undefined)
      ?? (typeof stageConfig?.sourceKind === "string" ? stageConfig.sourceKind : undefined),
    strategy: typeof stageConfig?.strategy === "string" ? stageConfig.strategy : undefined,
    outputTarget: typeof stageConfig?.outputTarget === "string" ? stageConfig.outputTarget : undefined,
  });
}

export class StageCanvasGraphProjectionService {
  private readonly mappingService: StageAssetMappingService;

  constructor(mappingService: StageAssetMappingService = new StageAssetMappingService()) {
    this.mappingService = mappingService;
  }

  public project(request: StageCanvasProjectionRequest): StageCanvasGraphModel {
    const groups: StageCanvasGroupViewModel[] = [];
    const nodes: StageCanvasAssetNodeViewModel[] = [];
    const edges: StageCanvasGraphEdgeViewModel[] = [];

    const stageNodesByStageId = new Map<string, ReadonlyArray<StageCanvasAssetNodeViewModel>>();

    for (const stage of request.stageFlow.stages) {
      const status = resolveStageStatus(stage.id, request.state);
      const stageHints = resolveStageMappingHints(stage.id, request.state);
      const mapping = this.mappingService.resolveStage({
        stageKind: stage.kind,
        detectedSourceKind: stageHints.detectedSourceKind,
        strategy: stageHints.strategy,
        outputTarget: stageHints.outputTarget,
      });

      const mappedAssets = mapping.status === "resolved"
        ? mapping.assets.map((asset) => ({ assetId: asset.assetId, assetVersion: asset.assetVersion }))
        : [];
      const assetRefs = dedupeAssetRefs(stage, mappedAssets);

      const groupId = `stage-group:${stage.id}`;
      const stageNodes = assetRefs.map((asset, index) => {
        const nodeId = `stage-node:${stage.id}:${asset.assetId}:${index + 1}`;
        const tracking = request.stageRuntimeTracking?.[stage.id];
        const node: StageCanvasAssetNodeViewModel = Object.freeze({
          id: nodeId,
          stageId: stage.id,
          groupId,
          assetId: asset.assetId,
          assetVersion: asset.assetVersion,
          title: asset.assetId,
          subtitle: asset.assetVersion ? `v${asset.assetVersion}` : "latest",
          metadata: Object.freeze({
            stageOrder: stage.order,
            stageKind: stage.kind,
            stageStatus: status,
            mappingPolicy: mapping.status === "resolved" ? mapping.policy : undefined,
            mappingReason: mapping.status === "resolved" ? mapping.reason : undefined,
            inspectable: tracking?.metadata.inspectability.inspectable ?? true,
            inspectionReference: tracking?.metadata.inspectability.inspectionReference,
            summaryReference: tracking?.metadata.inspectability.summaryReference,
            lineageId: tracking?.metadata.lineageHooks.lineageId,
            pipelineId: tracking?.metadata.lineageHooks.pipelineId,
          }),
        });
        return node;
      });

      const group: StageCanvasGroupViewModel = Object.freeze({
        id: groupId,
        stageId: stage.id,
        title: stage.name,
        description: stage.description,
        status,
        nodeIds: Object.freeze(stageNodes.map((node) => node.id)),
        metadata: Object.freeze({
          stageId: stage.id,
          stageKind: stage.kind,
          stageName: stage.name,
          stageDescription: stage.description,
          stageOrder: stage.order,
          stageStatus: status,
          summary: Object.freeze({
            assetNodeCount: stageNodes.length,
            acceptedInputShapeKinds: stage.dataContract.acceptedInputShapeKinds,
            producedOutputShapeKinds: stage.dataContract.producedOutputShapeKinds,
            executionMode: stage.executionPolicy.mode,
            autoConfigured: request.state?.autoConfiguredStageIds.includes(stage.id) ?? false,
            userOverridden: request.state?.userOverriddenStageIds.includes(stage.id) ?? false,
          }),
          configuration: normalizeRecord(request.state?.stageConfiguration[stage.id]),
          output: normalizeRecord(request.state?.stageOutputs[stage.id]),
          runtimeTracking: request.stageRuntimeTracking?.[stage.id],
        }),
      });

      groups.push(group);
      stageNodesByStageId.set(stage.id, Object.freeze(stageNodes));
      nodes.push(...stageNodes);
    }

    for (let index = 0; index < request.stageFlow.stages.length - 1; index += 1) {
      const sourceStage = request.stageFlow.stages[index];
      const targetStage = request.stageFlow.stages[index + 1];
      if (!sourceStage || !targetStage) {
        continue;
      }
      const sourceNodes = stageNodesByStageId.get(sourceStage.id) ?? [];
      const targetNodes = stageNodesByStageId.get(targetStage.id) ?? [];
      for (const sourceNode of sourceNodes) {
        for (const targetNode of targetNodes) {
          edges.push(Object.freeze({
            id: `stage-edge:${sourceNode.id}->${targetNode.id}`,
            kind: "stage-flow",
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceStageId: sourceStage.id,
            targetStageId: targetStage.id,
            label: "flow",
            metadata: Object.freeze({
              sourceStageOrder: sourceStage.order,
              targetStageOrder: targetStage.order,
            }),
          }));
        }
      }
    }

    for (const transition of request.stageFlow.conditionalTransitions) {
      const sourceStage = request.stageFlow.stages.find((stage) => stage.id === transition.fromStageId);
      const targetStage = request.stageFlow.stages.find((stage) => stage.id === transition.toStageId);
      if (!sourceStage || !targetStage) {
        continue;
      }
      const sourceNodes = stageNodesByStageId.get(sourceStage.id) ?? [];
      const targetNodes = stageNodesByStageId.get(targetStage.id) ?? [];
      for (const sourceNode of sourceNodes) {
        for (const targetNode of targetNodes) {
          edges.push(Object.freeze({
            id: `stage-edge:conditional:${transition.id}:${sourceNode.id}->${targetNode.id}`,
            kind: "conditional-stage-flow",
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceStageId: sourceStage.id,
            targetStageId: targetStage.id,
            label: "conditional",
            metadata: Object.freeze({
              sourceStageOrder: sourceStage.order,
              targetStageOrder: targetStage.order,
              conditionalTransitionId: transition.id,
              conditionId: transition.conditionId,
            }),
          }));
        }
      }
    }

    return Object.freeze({
      flowId: request.stageFlow.flowId,
      flowName: request.stageFlow.name,
      source: request.source,
      groups: Object.freeze(groups),
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      metadata: Object.freeze({
        stageCount: request.stageFlow.stages.length,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        currentStageId: request.state?.currentStageId,
        intentId: request.state?.intentContext?.id,
        intentTemplateId: request.state?.intentContext?.templateId,
        hasConditionalTransitions: request.stageFlow.conditionalTransitions.length > 0,
      }),
    });
  }

  public projectFromWizard(engine: WizardFlowEngine): StageCanvasGraphModel {
    return this.project({
      source: "wizard",
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
    });
  }

  public projectFromTemplateInstance(instance: PipelineTemplateInstance): StageCanvasGraphModel {
    return this.project({
      source: "template",
      stageFlow: instance.stageFlow,
      state: instance.state,
    });
  }

  public projectFromSavedFlow(input: {
    readonly stageFlow: StageFlowDefinition;
    readonly state?: StageFlowRuntimeState;
    readonly stageRuntimeTracking?: Readonly<Record<string, StageRuntimeTracking>>;
  }): StageCanvasGraphModel {
    return this.project({
      source: "saved",
      stageFlow: input.stageFlow,
      state: input.state,
      stageRuntimeTracking: input.stageRuntimeTracking,
    });
  }
}

export function createStageCanvasGraphProjectionService(
  mappingService?: StageAssetMappingService,
): StageCanvasGraphProjectionService {
  return new StageCanvasGraphProjectionService(mappingService);
}
