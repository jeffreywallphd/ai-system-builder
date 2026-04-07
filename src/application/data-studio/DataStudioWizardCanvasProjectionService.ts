import type {
  DataStudioWizardCanvasHandoff,
  DataStudioWizardSnapshot,
  DataStudioWizardStageSnapshot,
} from "./DataStudioPreparationWizard";
import type { StudioAuthoringGraphProjection } from "../studio-shell/StudioAuthoringGraph";

export interface DataStudioCanvasProjection {
  readonly currentStageId: string;
  readonly graph: StudioAuthoringGraphProjection;
  readonly stageSummaries: ReadonlyArray<{
    readonly stageId: string;
    readonly title: string;
    readonly status: DataStudioWizardStageSnapshot["status"];
    readonly isAvailable: boolean;
    readonly isOptional: boolean;
    readonly configMode: DataStudioWizardStageSnapshot["configMode"];
    readonly visibility: DataStudioWizardStageSnapshot["visibility"];
    readonly assetGroupIds: ReadonlyArray<string>;
  }>;
}

function freezeRecord(value: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  return value ? Object.freeze({ ...value }) : undefined;
}

function toStageMetadata(stage: DataStudioWizardStageSnapshot): Readonly<Record<string, unknown>> {
  return Object.freeze({
    stageId: stage.stageId,
    stageTitle: stage.title,
    stageStatus: stage.status,
    isStageCurrent: stage.status === "current",
    isStageAvailable: stage.availability.isAvailable,
    stageAvailabilityReason: stage.availability.reason,
    isStageOptional: stage.isOptional,
    configMode: stage.configMode,
    visibility: stage.visibility,
    activationMode: stage.activation.mode,
    optionKeys: Object.freeze(Object.keys(stage.options)),
    assetGroupIds: stage.assetGroupIds,
  });
}

function withStageAwareGraphMetadata(
  sourceGraph: StudioAuthoringGraphProjection,
  stageById: ReadonlyMap<string, DataStudioWizardStageSnapshot>,
): StudioAuthoringGraphProjection {
  return Object.freeze({
    source: "canvas",
    nodes: Object.freeze(sourceGraph.nodes.map((node) => {
      const stageId = typeof node.metadata?.stageId === "string" ? node.metadata.stageId : undefined;
      const stage = stageId ? stageById.get(stageId) : undefined;
      return Object.freeze({
        ...node,
        metadata: Object.freeze({
          ...(freezeRecord(node.metadata) ?? {}),
          ...(stage ? toStageMetadata(stage) : {}),
        }),
      });
    })),
    edges: Object.freeze(sourceGraph.edges.map((edge) => {
      const sourceStageId = typeof edge.metadata?.sourceStageId === "string" ? edge.metadata.sourceStageId : undefined;
      const targetStageId = typeof edge.metadata?.targetStageId === "string" ? edge.metadata.targetStageId : undefined;
      const sourceStage = sourceStageId ? stageById.get(sourceStageId) : undefined;
      const targetStage = targetStageId ? stageById.get(targetStageId) : undefined;
      const isActive = sourceStage?.availability.isAvailable === true
        && targetStage?.availability.isAvailable === true;

      return Object.freeze({
        ...edge,
        metadata: Object.freeze({
          ...(freezeRecord(edge.metadata) ?? {}),
          isActiveTransition: isActive,
          sourceStageStatus: sourceStage?.status,
          targetStageStatus: targetStage?.status,
        }),
      });
    })),
    groups: Object.freeze(sourceGraph.groups.map((group) => {
      const stageId = group.id.startsWith("group:") ? group.id.slice("group:".length) : undefined;
      const stage = stageId ? stageById.get(stageId) : undefined;
      return Object.freeze({
        ...group,
        metadata: Object.freeze({
          ...(freezeRecord(group.metadata) ?? {}),
          ...(stage ? toStageMetadata(stage) : {}),
        }),
      });
    })),
  });
}

export class DataStudioWizardCanvasProjectionService {
  public projectFromWizardSnapshot(snapshot: DataStudioWizardSnapshot): DataStudioCanvasProjection {
    const stageById = new Map(snapshot.stages.map((stage) => [stage.stageId, stage]));
    const graph = withStageAwareGraphMetadata(snapshot.authoringGraph, stageById);

    return Object.freeze({
      currentStageId: snapshot.currentStageId,
      graph,
      stageSummaries: Object.freeze(snapshot.stages.map((stage) => Object.freeze({
        stageId: stage.stageId,
        title: stage.title,
        status: stage.status,
        isAvailable: stage.availability.isAvailable,
        isOptional: stage.isOptional,
        configMode: stage.configMode,
        visibility: stage.visibility,
        assetGroupIds: stage.assetGroupIds,
      }))),
    });
  }

  public projectFromCanvasHandoff(handoff: DataStudioWizardCanvasHandoff): DataStudioCanvasProjection {
    const stageById = new Map(handoff.stages.map((stage) => [stage.stageId, stage]));
    const graph = withStageAwareGraphMetadata(handoff.authoringGraph, stageById);

    return Object.freeze({
      currentStageId: handoff.currentStageId,
      graph,
      stageSummaries: Object.freeze(handoff.stages.map((stage) => Object.freeze({
        stageId: stage.stageId,
        title: stage.title,
        status: stage.status,
        isAvailable: stage.availability.isAvailable,
        isOptional: stage.isOptional,
        configMode: stage.configMode,
        visibility: stage.visibility,
        assetGroupIds: stage.assetGroupIds,
      }))),
    });
  }
}
