import {
  StageExecutionPolicy,
} from "../../../application/dataset-studio/StageExecutionPolicy";
import { TemplateService } from "../../../application/dataset-studio/TemplateService";
import { WizardFlowEngine } from "../../../application/dataset-studio/WizardFlowEngine";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";

export type DatasetStageWizardStageStatus = "current" | "completed" | "skipped" | "pending" | "disabled";

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
  private readonly engine: WizardFlowEngine;

  constructor(options?: {
    readonly templateId?: string;
    readonly templateService?: TemplateService;
    readonly stageExecutionPolicy?: StageExecutionPolicy;
  }) {
    const templateService = options?.templateService ?? new TemplateService();
    const template = templateService.getTemplate(options?.templateId ?? "elt-default");
    this.engine = new WizardFlowEngine({
      template,
      stageExecutionPolicy: options?.stageExecutionPolicy ?? new StageExecutionPolicy(),
    });
  }

  public getSnapshot(): DatasetStageWizardSnapshot {
    const uiSnapshot = this.engine.toUiSnapshot();
    const stageOrder = uiSnapshot.stages.map((stage) => stage.id);
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

  public goNext(): void {
    this.engine.goNext();
  }

  public goBack(): void {
    this.engine.goBack();
  }

  public updateStageConfiguration(
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
  ): void {
    this.engine.setStageConfiguration(stageId, configuration);
  }
}
