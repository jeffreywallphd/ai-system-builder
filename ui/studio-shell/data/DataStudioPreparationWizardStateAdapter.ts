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

export interface DataStudioStageInternalsSnapshot {
  readonly stageId: PipelineStageId;
  readonly stageTitle: string;
  readonly status: DataStudioWizardStageSnapshot["status"];
  readonly options: Readonly<Record<string, CanonicalRecordValue>>;
  readonly visibility: DataStudioWizardStageSnapshot["visibility"];
  readonly activationMode: DataStudioWizardStageSnapshot["activation"]["mode"];
  readonly assetGroupIds: ReadonlyArray<string>;
  readonly nodeIds: ReadonlyArray<string>;
  readonly incomingEdgeIds: ReadonlyArray<string>;
  readonly outgoingEdgeIds: ReadonlyArray<string>;
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

  public getStage(stageId: PipelineStageId): DataStudioWizardStageSnapshot | undefined {
    return this.getSnapshot().stages.find((stage) => stage.stageId === stageId);
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

  public findCanvasNodeIdForStage(stageId: PipelineStageId): string | undefined {
    const projection = this.toCanvasProjection();
    return projection.graph.nodes.find((node) => node.metadata?.stageId === stageId)?.id;
  }

  public getStageInternals(stageId: PipelineStageId): DataStudioStageInternalsSnapshot | undefined {
    const stage = this.getStage(stageId);
    if (!stage) {
      return undefined;
    }

    const projection = this.toCanvasProjection();
    const stageNodes = projection.graph.nodes.filter((node) => node.metadata?.stageId === stageId);
    const incomingEdges = projection.graph.edges.filter((edge) => edge.metadata?.targetStageId === stageId);
    const outgoingEdges = projection.graph.edges.filter((edge) => edge.metadata?.sourceStageId === stageId);

    return Object.freeze({
      stageId,
      stageTitle: stage.title,
      status: stage.status,
      options: stage.options,
      visibility: stage.visibility,
      activationMode: stage.activation.mode,
      assetGroupIds: stage.assetGroupIds,
      nodeIds: Object.freeze(stageNodes.map((node) => node.id)),
      incomingEdgeIds: Object.freeze(incomingEdges.map((edge) => edge.id)),
      outgoingEdgeIds: Object.freeze(outgoingEdges.map((edge) => edge.id)),
    });
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
