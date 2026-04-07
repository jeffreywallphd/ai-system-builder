import {
  StageExecutionPolicy,
} from "@application/dataset-studio/StageExecutionPolicy";
import {
  StageCanvasEditingService,
  type StageCanvasEditResult,
} from "@application/dataset-studio/StageCanvasEditingService";
import {
  StageCanvasGraphProjectionService,
  type StageCanvasGraphModel,
} from "@application/dataset-studio/StageCanvasGraphProjectionService";
import {
  StagePipelinePersistenceService,
  type PersistedStagePipelineDocument,
} from "@application/dataset-studio/StagePipelinePersistenceService";
import {
  StageOutputInspectionService,
  type StageOutputInspectionModel,
} from "@application/dataset-studio/StageOutputInspectionService";
import { TemplateService } from "@application/dataset-studio/TemplateService";
import { WizardFlowEngine } from "@application/dataset-studio/WizardFlowEngine";
import type { DatasetPipelineStageKind } from "@domain/dataset-studio/StagePipelineDomain";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type { WizardStageStatus } from "../wizard/WizardStageContracts";

export type DatasetStageWizardStageStatus = WizardStageStatus;

export interface DatasetStageWizardStageViewModel {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly status: DatasetStageWizardStageStatus;
  readonly executionMode: string;
  readonly isDisabled: boolean;
  readonly configuration: Readonly<Record<string, CanonicalRecordValue>>;
  readonly metadata: {
    readonly acceptedInputShapeKinds: ReadonlyArray<string>;
    readonly producedOutputShapeKinds: ReadonlyArray<string>;
    readonly assetReferences: ReadonlyArray<{ readonly assetId: string; readonly assetVersion?: string }>;
    readonly stageCategory: string;
    readonly statusMarker: string;
    readonly lineageId?: string;
    readonly pipelineId?: string;
  };
  readonly inspection: StageOutputInspectionModel;
}

export interface DatasetStageWizardSnapshot {
  readonly flowId: string;
  readonly flowName: string;
  readonly currentStageId: string;
  readonly currentStage?: DatasetStageWizardStageViewModel;
  readonly stages: ReadonlyArray<DatasetStageWizardStageViewModel>;
  readonly progressPercent: number;
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
}

function toDisabledStatus(
  stageOrder: ReadonlyArray<string>,
  currentStageId: string,
  stageId: string,
): boolean {
  const currentIndex = stageOrder.findIndex((entry) => entry === currentStageId);
  const stageIndex = stageOrder.findIndex((entry) => entry === stageId);
  if (currentIndex < 0 || stageIndex < 0) {
    return false;
  }
  return stageIndex > currentIndex + 1;
}

function resolveStatus(
  stage: {
    readonly id: string;
    readonly status: "current" | "completed" | "skipped" | "pending";
  },
  isDisabled: boolean,
): DatasetStageWizardStageStatus {
  if (stage.status !== "pending") {
    return stage.status;
  }
  return isDisabled ? "disabled" : "pending";
}

function computeProgressPercent(stages: ReadonlyArray<DatasetStageWizardStageViewModel>): number {
  if (stages.length === 0) {
    return 0;
  }
  const completed = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completed / stages.length) * 100);
}

export class DatasetStageWizardStateAdapter {
  private engine: WizardFlowEngine;
  private readonly graphProjectionService: StageCanvasGraphProjectionService;
  private readonly editingService: StageCanvasEditingService;
  private readonly stageExecutionPolicy: StageExecutionPolicy;
  private readonly inspectionService: StageOutputInspectionService;
  private readonly persistenceService: StagePipelinePersistenceService;

  constructor(options?: {
    readonly templateId?: string;
    readonly templateService?: TemplateService;
    readonly stageExecutionPolicy?: StageExecutionPolicy;
    readonly graphProjectionService?: StageCanvasGraphProjectionService;
    readonly editingService?: StageCanvasEditingService;
    readonly inspectionService?: StageOutputInspectionService;
    readonly persistenceService?: StagePipelinePersistenceService;
    readonly persistedPipeline?: PersistedStagePipelineDocument | string | unknown;
  }) {
    const templateService = options?.templateService ?? new TemplateService();
    this.stageExecutionPolicy = options?.stageExecutionPolicy ?? new StageExecutionPolicy();
    this.inspectionService = options?.inspectionService ?? new StageOutputInspectionService();
    this.persistenceService = options?.persistenceService ?? new StagePipelinePersistenceService();
    const persisted = options?.persistedPipeline
      ? this.toPersistedDocument(options.persistedPipeline)
      : undefined;

    if (persisted) {
      this.engine = this.persistenceService.rehydrateWizardEngine(persisted, {
        stageExecutionPolicy: this.stageExecutionPolicy,
      });
    } else {
      const template = templateService.getTemplate(options?.templateId ?? "elt-default");
      this.engine = new WizardFlowEngine({
        template,
        stageExecutionPolicy: this.stageExecutionPolicy,
      });
    }

    this.graphProjectionService = options?.graphProjectionService ?? new StageCanvasGraphProjectionService();
    this.editingService = options?.editingService ?? new StageCanvasEditingService({
      projectionService: this.graphProjectionService,
      templateService,
    });
  }

  public getSnapshot(): DatasetStageWizardSnapshot {
    const uiSnapshot = this.engine.toUiSnapshot();
    const stageOrder = uiSnapshot.stages.map((stage) => stage.id);
    const inspectionByStageId = this.inspectionService.inspectFlow({
      stageFlow: this.engine.getStageFlow(),
      state: this.engine.getState(),
      stageRuntimeTracking: this.engine.getStageRuntimeTracking(),
    });
    const stages = Object.freeze(uiSnapshot.stages.map((stage) => {
      const isDisabled = toDisabledStatus(stageOrder, uiSnapshot.currentStageId, stage.id);
      return Object.freeze({
        id: stage.id,
        kind: stage.kind,
        name: stage.name,
        description: stage.description,
        order: stage.order,
        status: resolveStatus(stage, isDisabled),
        executionMode: stage.executionMode,
        isDisabled,
        configuration: stage.configuration,
        metadata: {
          acceptedInputShapeKinds: stage.metadata.acceptedInputShapeKinds,
          producedOutputShapeKinds: stage.metadata.producedOutputShapeKinds,
          assetReferences: stage.metadata.assetReferences,
          stageCategory: stage.metadata.stageCategory,
          statusMarker: stage.metadata.statusMarker,
          lineageId: stage.metadata.lineageId,
          pipelineId: stage.metadata.pipelineId,
        },
        inspection: inspectionByStageId[stage.id],
      } satisfies DatasetStageWizardStageViewModel);
    }));

    const currentStage = stages.find((stage) => stage.id === uiSnapshot.currentStageId);
    const navigation = this.engine.getState();
    return Object.freeze({
      flowId: uiSnapshot.flowId,
      flowName: uiSnapshot.flowName,
      currentStageId: uiSnapshot.currentStageId,
      currentStage,
      stages,
      progressPercent: computeProgressPercent(stages),
      canGoBack: navigation.currentStageId !== stages[0]?.id,
      canGoNext: true,
    });
  }

  public getCanvasGraph(): StageCanvasGraphModel {
    return this.graphProjectionService.projectFromWizard(this.engine);
  }

  public listAddableOptionalStages(): ReadonlyArray<{ readonly stageKind: DatasetPipelineStageKind; readonly name: string }> {
    return Object.freeze(this.editingService.listAddableOptionalStages(this.engine).map((stage) => Object.freeze({
      stageKind: stage.kind,
      name: stage.name,
    })));
  }

  public goNext(): void {
    this.engine.goNext();
  }

  public goBack(): void {
    this.engine.goBack();
  }

  public updateStageConfiguration(
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageCanvasEditResult {
    return this.editingService.updateStageConfiguration(this.engine, stageId, configuration);
  }

  public reorderStages(orderedStageIds: ReadonlyArray<string>): StageCanvasEditResult {
    return this.editingService.reorderStages(this.engine, orderedStageIds);
  }

  public addOptionalStage(stageKind: DatasetPipelineStageKind): StageCanvasEditResult {
    return this.editingService.addOptionalStage(this.engine, stageKind);
  }

  public removeOptionalStage(stageId: string): StageCanvasEditResult {
    return this.editingService.removeOptionalStage(this.engine, stageId);
  }

  public regenerateGraph(): StageCanvasGraphModel {
    return this.editingService.regenerateGraph(this.engine);
  }

  public exportPersistedPipeline(): PersistedStagePipelineDocument {
    return this.persistenceService.saveFromWizard({
      engine: this.engine,
    });
  }

  public exportPersistedPipelineJson(): string {
    return this.persistenceService.serialize(this.exportPersistedPipeline());
  }

  public importPersistedPipeline(
    persisted: PersistedStagePipelineDocument | string | unknown,
  ): PersistedStagePipelineDocument {
    const decoded = this.toPersistedDocument(persisted);
    this.engine = this.persistenceService.rehydrateWizardEngine(decoded, {
      stageExecutionPolicy: this.stageExecutionPolicy,
    });
    return decoded;
  }

  private toPersistedDocument(
    persisted: PersistedStagePipelineDocument | string | unknown,
  ): PersistedStagePipelineDocument {
    if (typeof persisted === "string") {
      return this.persistenceService.deserialize(persisted);
    }
    return this.persistenceService.decode(persisted);
  }
}

