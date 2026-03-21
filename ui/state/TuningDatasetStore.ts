import type {
  DatasetExportArtifact,
  DatasetSourceDocument,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetWorkflowStage,
  DatasetWorkflowState,
  ExampleStatus,
  ExportFormat,
  SplitType,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { DatasetDetails, DatasetSummary, StudioExample } from "../../application/tuning-datasets/contracts";
import { buildDatasetWorkflowWizard } from "../../application/tuning-datasets/buildDatasetWorkflowWizard";
import type { LinearWizardDefinition } from "../../application/wizards/contracts";
import { TuningDatasetService } from "../services/TuningDatasetService";

export interface TuningDatasetStoreState {
  readonly datasets: ReadonlyArray<DatasetSummary>;
  readonly selectedDatasetId?: string;
  readonly selectedVersionId?: string;
  readonly selectedDataset?: DatasetDetails;
  readonly examples: ReadonlyArray<StudioExample>;
  readonly selectedExampleIds: ReadonlyArray<string>;
  readonly sourceDocuments: ReadonlyArray<DatasetSourceDocument>;
  readonly validation?: DatasetValidationResult;
  readonly statistics?: DatasetStatistics;
  readonly exports: ReadonlyArray<DatasetExportArtifact>;
  readonly duplicates: ReadonlyArray<{ readonly fingerprint: string; readonly exampleIds: ReadonlyArray<string> }>;
  readonly workflow?: DatasetWorkflowState;
  readonly wizard: LinearWizardDefinition<DatasetWorkflowStage>;
  readonly currentWorkflowStage: DatasetWorkflowStage;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error?: string;
}

export type TuningDatasetStoreListener = (state: TuningDatasetStoreState) => void;

const defaultState: TuningDatasetStoreState = Object.freeze({
  datasets: Object.freeze([]),
  selectedDatasetId: undefined,
  selectedVersionId: undefined,
  selectedDataset: undefined,
  examples: Object.freeze([]),
  selectedExampleIds: Object.freeze([]),
  sourceDocuments: Object.freeze([]),
  validation: undefined,
  statistics: undefined,
  exports: Object.freeze([]),
  duplicates: Object.freeze([]),
  workflow: undefined,
  wizard: buildDatasetWorkflowWizard({ currentStage: "dataset_definition" }),
  currentWorkflowStage: "dataset_definition",
  isLoading: false,
  isMutating: false,
  error: undefined,
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected tuning dataset error.";
}

export class TuningDatasetStore {
  private state: TuningDatasetStoreState = defaultState;
  private readonly listeners = new Set<TuningDatasetStoreListener>();

  constructor(private readonly service: TuningDatasetService) {}

  public getState(): TuningDatasetStoreState {
    return this.state;
  }

  public subscribe(listener: TuningDatasetStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async initialize(): Promise<void> {
    await this.refreshDatasets();
  }

  public async refreshDatasets(selectedDatasetId?: string, selectedVersionId?: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const datasets = await this.service.listDatasets();
      const nextSelectedDatasetId = selectedDatasetId ?? this.state.selectedDatasetId ?? datasets[0]?.dataset.id;
      const summary = datasets.find((entry) => entry.dataset.id === nextSelectedDatasetId);
      const nextSelectedVersionId = selectedVersionId ?? summary?.selectedVersion?.id ?? summary?.latestVersion?.id;
      this.patch({ datasets, selectedDatasetId: nextSelectedDatasetId, selectedVersionId: nextSelectedVersionId, isLoading: false });
      if (nextSelectedDatasetId) {
        await this.selectDataset(nextSelectedDatasetId, nextSelectedVersionId);
      }
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async selectDataset(datasetId: string | undefined, versionId?: string): Promise<void> {
    if (!datasetId) {
      this.patch({
        selectedDatasetId: undefined,
        selectedVersionId: undefined,
        selectedDataset: undefined,
        examples: Object.freeze([]),
        selectedExampleIds: Object.freeze([]),
        sourceDocuments: Object.freeze([]),
        validation: undefined,
        statistics: undefined,
        exports: Object.freeze([]),
        duplicates: Object.freeze([]),
        workflow: undefined,
        wizard: buildDatasetWorkflowWizard({ currentStage: "dataset_definition" }),
        currentWorkflowStage: "dataset_definition",
      });
      return;
    }

    this.patch({ isLoading: true, error: undefined, selectedDatasetId: datasetId, selectedVersionId: versionId ?? this.state.selectedVersionId });
    try {
      const details = await this.service.getDatasetDetails(datasetId, versionId ?? this.state.selectedVersionId);
      const selectedVersionId = details.selectedVersion?.id;
      const examples = selectedVersionId ? await this.service.listExamples({ datasetId, versionId: selectedVersionId }) : [];
      const duplicates = selectedVersionId ? await this.service.detectDuplicates(datasetId, selectedVersionId) : [];
      const exports = selectedVersionId ? await this.service.listExports(datasetId, selectedVersionId) : [];
      this.patch({
        selectedDataset: details,
        selectedDatasetId: datasetId,
        selectedVersionId,
        sourceDocuments: Object.freeze([...details.sourceDocuments]),
        examples: Object.freeze([...examples]),
        selectedExampleIds: Object.freeze([]),
        validation: details.validation,
        statistics: details.statistics,
        exports: Object.freeze([...exports]),
        duplicates: Object.freeze([...duplicates]),
        workflow: details.workflow,
        wizard: buildDatasetWorkflowWizard({ workflow: details.workflow }),
        currentWorkflowStage: details.workflow.currentStage,
        isLoading: false,
      });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async selectVersion(versionId: string): Promise<void> {
    if (!this.state.selectedDatasetId) {
      return;
    }
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.selectDatasetVersion(this.state.selectedDatasetId, versionId);
      this.patch({ isMutating: false });
      await this.selectDataset(this.state.selectedDatasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async createDataset(params: { name: string; description?: string; taskType: import("../../domain/tuning-datasets/interfaces/ITuningDatasetStudio").DatasetTaskType; tags?: ReadonlyArray<string>; createdBy: string }): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      const details = await this.service.createDataset({ ...params, initializeVersion: true });
      this.patch({ isMutating: false });
      await this.refreshDatasets(details.dataset.id, details.selectedVersion?.id);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async createSuccessorVersion(releasedVersionId: string, createdBy: string): Promise<void> {
    if (!this.state.selectedDatasetId) {
      return;
    }
    this.patch({ isMutating: true, error: undefined });
    try {
      const details = await this.service.createSuccessorDatasetVersion(this.state.selectedDatasetId, releasedVersionId, createdBy);
      this.patch({ isMutating: false });
      await this.refreshDatasets(details.dataset.id, details.selectedVersion?.id);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async importSources(datasetId: string, versionId: string, createdBy: string, documents: ReadonlyArray<{ name: string; content: string; sourceType?: "manual_text" | "uploaded_text" | "uploaded_file"; mediaType?: string; metadata?: Readonly<Record<string, unknown>> }>): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.importSourceDocuments({ datasetId, versionId, createdBy, documents });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async generateExamples(datasetId: string, versionId: string, createdBy: string, sourceDocumentIds: ReadonlyArray<string>): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.generateExamples({ datasetId, versionId, createdBy, sourceDocumentIds, configuration: { strategy: "default-local" } });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async addExample(command: import("../../application/tuning-datasets/contracts").AddExampleCommand): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.addExample(command);
      this.patch({ isMutating: false });
      await this.selectDataset(command.datasetId, command.versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updateExample(command: import("../../application/tuning-datasets/contracts").UpdateExampleCommand): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.updateExample(command);
      this.patch({ isMutating: false });
      await this.selectDataset(command.datasetId, command.versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async deleteExample(datasetId: string, versionId: string, exampleId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.deleteExample(datasetId, versionId, exampleId);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public toggleExampleSelection(exampleId: string): void {
    this.patch({
      selectedExampleIds: this.state.selectedExampleIds.includes(exampleId)
        ? this.state.selectedExampleIds.filter((id) => id !== exampleId)
        : [...this.state.selectedExampleIds, exampleId],
    });
  }

  public clearExampleSelection(): void {
    this.patch({ selectedExampleIds: Object.freeze([]) });
  }

  public async bulkUpdateSelection(params: { status?: ExampleStatus; split?: SplitType; annotationNote?: string; updatedBy: string }): Promise<void> {
    if (!this.state.selectedDatasetId || !this.state.selectedVersionId || this.state.selectedExampleIds.length === 0) {
      return;
    }
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.bulkUpdateExamples({
        datasetId: this.state.selectedDatasetId,
        versionId: this.state.selectedVersionId,
        exampleIds: this.state.selectedExampleIds,
        ...params,
      });
      this.patch({ isMutating: false, selectedExampleIds: Object.freeze([]) });
      await this.selectDataset(this.state.selectedDatasetId, this.state.selectedVersionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async reviewExample(datasetId: string, versionId: string, exampleId: string, status: "accepted" | "rejected" | "needs_review", reviewer: string, note?: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.reviewExample(datasetId, versionId, exampleId, status, reviewer, note);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async validateDataset(datasetId: string, versionId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.validateDatasetVersion(datasetId, versionId);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async assignSplits(datasetId: string, versionId: string, actor: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.assignSplits(datasetId, versionId, actor);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updateSplit(datasetId: string, versionId: string, exampleId: string, split: SplitType, actor: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.updateSplitAssignment(datasetId, versionId, exampleId, split, actor);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async goToPreviousWorkflowStage(): Promise<void> {
    if (!this.state.selectedDatasetId || !this.state.selectedVersionId || !this.state.wizard.previousStepId) {
      return;
    }
    await this.moveWorkflowStage(this.state.selectedDatasetId, this.state.selectedVersionId, this.state.wizard.previousStepId);
  }

  public async goToNextWorkflowStage(): Promise<void> {
    if (!this.state.selectedDatasetId || !this.state.selectedVersionId || !this.state.wizard.nextStepId) {
      return;
    }
    await this.moveWorkflowStage(this.state.selectedDatasetId, this.state.selectedVersionId, this.state.wizard.nextStepId);
  }

  public async moveWorkflowStage(datasetId: string, versionId: string, stage: DatasetWorkflowStage): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      const workflow = await this.service.moveWorkflowStage(datasetId, versionId, stage);
      this.patch({ isMutating: false, workflow, wizard: buildDatasetWorkflowWizard({ workflow }), currentWorkflowStage: workflow.currentStage });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async releaseVersion(datasetId: string, versionId: string, releaseNotes?: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.releaseDatasetVersion(datasetId, versionId, releaseNotes);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async exportVersion(datasetId: string, versionId: string, format: ExportFormat): Promise<DatasetExportArtifact> {
    this.patch({ isMutating: true, error: undefined });
    try {
      const artifact = await this.service.exportDatasetVersion({ datasetId, versionId, format });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId, versionId);
      return artifact;
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private patch(patch: Partial<TuningDatasetStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      datasets: patch.datasets ?? this.state.datasets,
      examples: patch.examples ?? this.state.examples,
      selectedExampleIds: patch.selectedExampleIds ?? this.state.selectedExampleIds,
      sourceDocuments: patch.sourceDocuments ?? this.state.sourceDocuments,
      exports: patch.exports ?? this.state.exports,
      duplicates: patch.duplicates ?? this.state.duplicates,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
