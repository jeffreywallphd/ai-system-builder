import {
  DataStudioPreparationWizard,
  DataStudioWizardPresentationModes,
  type DataStudioWizardCanvasHandoff,
  type DataStudioWizardNavigationResult,
  type DataStudioWizardSnapshot,
  type DataStudioWizardStageSnapshot,
  type DataStudioPreparationTemplateSummary,
  type DataStudioWizardValidationIssue,
} from "../../../application/data-studio/DataStudioPreparationWizard";
import {
  DataStudioWizardCanvasProjectionService,
  type DataStudioCanvasProjection,
} from "../../../application/data-studio/DataStudioWizardCanvasProjectionService";
import type { DataStudioPipelineState } from "../../../application/data-studio/DataStudioPipelineState";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineStageId } from "../../../domain/dataset-studio/PipelineStageDomain";
import type {
  UnifiedPreparationStageActivation,
  UnifiedPreparationVisibilityMode,
} from "../../../domain/dataset-studio/UnifiedPreparationAsset";

export interface DataStudioPreparationWizardAdapterUpdateResult {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<DataStudioWizardValidationIssue>;
}

function okResult(): DataStudioPreparationWizardAdapterUpdateResult {
  return Object.freeze({
    ok: true,
    issues: Object.freeze([]),
  });
}

function issueResult(message: string, stageId?: PipelineStageId): DataStudioPreparationWizardAdapterUpdateResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({
      code: "data-wizard.update-failed",
      message,
      severity: "error" as const,
      stageId,
    })]),
  });
}

export class DataStudioPreparationWizardStateAdapter {
  private readonly wizard: DataStudioPreparationWizard;
  private readonly canvasProjectionService: DataStudioWizardCanvasProjectionService;

  constructor(
    wizardOrOptions?: DataStudioPreparationWizard | {
      readonly wizard?: DataStudioPreparationWizard;
      readonly persistedState?: DataStudioPipelineState | string;
    },
  ) {
    if (wizardOrOptions instanceof DataStudioPreparationWizard) {
      this.wizard = wizardOrOptions;
      this.canvasProjectionService = new DataStudioWizardCanvasProjectionService();
      return;
    }
    this.wizard = wizardOrOptions?.wizard ?? new DataStudioPreparationWizard();
    this.canvasProjectionService = new DataStudioWizardCanvasProjectionService();
    if (wizardOrOptions?.persistedState) {
      this.wizard.importPipelineState(wizardOrOptions.persistedState);
    }
  }

  public getSnapshot(): DataStudioWizardSnapshot {
    return this.wizard.getSnapshot();
  }

  public getCurrentStage(): DataStudioWizardStageSnapshot | undefined {
    const snapshot = this.getSnapshot();
    return snapshot.stages.find((stage) => stage.stageId === snapshot.currentStageId);
  }

  public listTemplates(): ReadonlyArray<DataStudioPreparationTemplateSummary> {
    return this.wizard.listTemplates();
  }

  public selectTemplate(templateId: string): DataStudioPreparationWizardAdapterUpdateResult {
    try {
      this.wizard.selectTemplate(templateId);
      return okResult();
    } catch (error) {
      return issueResult((error as Error).message);
    }
  }

  public goNext(): DataStudioWizardNavigationResult {
    return this.wizard.goNext();
  }

  public goBack(): DataStudioWizardNavigationResult {
    return this.wizard.goBack();
  }

  public goToStage(stageId: PipelineStageId): DataStudioWizardNavigationResult {
    return this.wizard.goToStage(stageId);
  }

  public setSimpleMode(): DataStudioWizardSnapshot {
    return this.wizard.setPresentationMode(DataStudioWizardPresentationModes.simple);
  }

  public setAdvancedMode(): DataStudioWizardSnapshot {
    return this.wizard.setPresentationMode(DataStudioWizardPresentationModes.advanced);
  }

  public setStageOptions(
    stageId: PipelineStageId,
    options: Readonly<Record<string, CanonicalRecordValue>>,
  ): DataStudioPreparationWizardAdapterUpdateResult {
    try {
      this.wizard.setStageOptions(stageId, options);
      return okResult();
    } catch (error) {
      return issueResult((error as Error).message, stageId);
    }
  }

  public setStageVisibility(
    stageId: PipelineStageId,
    visibility: UnifiedPreparationVisibilityMode,
  ): DataStudioPreparationWizardAdapterUpdateResult {
    try {
      this.wizard.setStageVisibility(stageId, visibility);
      return okResult();
    } catch (error) {
      return issueResult((error as Error).message, stageId);
    }
  }

  public setStageActivation(
    stageId: PipelineStageId,
    activation: UnifiedPreparationStageActivation,
  ): DataStudioPreparationWizardAdapterUpdateResult {
    try {
      this.wizard.setStageActivation(stageId, activation);
      return okResult();
    } catch (error) {
      return issueResult((error as Error).message, stageId);
    }
  }

  public toCanvasHandoff(): DataStudioWizardCanvasHandoff {
    return this.wizard.toCanvasHandoff();
  }

  public toCanvasProjection(): DataStudioCanvasProjection {
    return this.canvasProjectionService.projectFromCanvasHandoff(this.toCanvasHandoff());
  }

  public exportPipelineState(): DataStudioPipelineState {
    return this.wizard.exportPipelineState();
  }

  public exportPipelineStateJson(): string {
    return this.wizard.exportPipelineStateJson();
  }

  public importPipelineState(input: DataStudioPipelineState | string): DataStudioPreparationWizardAdapterUpdateResult {
    try {
      this.wizard.importPipelineState(input);
      return okResult();
    } catch (error) {
      return issueResult((error as Error).message);
    }
  }
}
