import {
  DataStudioPreparationWizard,
  DataStudioWizardPresentationModes,
  type DataStudioWizardCanvasHandoff,
  type DataStudioWizardNavigationResult,
  type DataStudioWizardSnapshot,
  type DataStudioWizardStageSnapshot,
  type DataStudioWizardValidationIssue,
} from "../../../application/data-studio/DataStudioPreparationWizard";
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

  constructor(wizard?: DataStudioPreparationWizard) {
    this.wizard = wizard ?? new DataStudioPreparationWizard();
  }

  public getSnapshot(): DataStudioWizardSnapshot {
    return this.wizard.getSnapshot();
  }

  public getCurrentStage(): DataStudioWizardStageSnapshot | undefined {
    const snapshot = this.getSnapshot();
    return snapshot.stages.find((stage) => stage.stageId === snapshot.currentStageId);
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
}
