import type { DatasetExportArtifact, DatasetStatistics, DatasetValidationResult } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { QuestionAnsweringExample, SourceDocumentReference } from "../../domain/tuning-datasets/TuningDatasetEntities";
import type { DatasetDetails, DatasetSummary } from "../../application/tuning-datasets/contracts";
import { TuningDatasetService } from "../services/TuningDatasetService";

export interface TuningDatasetStoreState {
  readonly datasets: ReadonlyArray<DatasetSummary>;
  readonly selectedDatasetId?: string;
  readonly selectedDataset?: DatasetDetails;
  readonly examples: ReadonlyArray<QuestionAnsweringExample>;
  readonly sourceDocuments: ReadonlyArray<SourceDocumentReference>;
  readonly validation?: DatasetValidationResult;
  readonly statistics?: DatasetStatistics;
  readonly exports: ReadonlyArray<DatasetExportArtifact>;
  readonly duplicates: ReadonlyArray<{ readonly fingerprint: string; readonly exampleIds: ReadonlyArray<string> }>;
  readonly activeWorkspaceTab: "overview" | "sources" | "examples" | "validation" | "splits" | "versions" | "exports";
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error?: string;
}

export type TuningDatasetStoreListener = (state: TuningDatasetStoreState) => void;

const defaultState: TuningDatasetStoreState = Object.freeze({
  datasets: Object.freeze([]),
  selectedDatasetId: undefined,
  selectedDataset: undefined,
  examples: Object.freeze([]),
  sourceDocuments: Object.freeze([]),
  validation: undefined,
  statistics: undefined,
  exports: Object.freeze([]),
  duplicates: Object.freeze([]),
  activeWorkspaceTab: "overview",
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

  public async refreshDatasets(selectedDatasetId?: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const datasets = await this.service.listDatasets();
      const nextSelectedDatasetId = selectedDatasetId ?? this.state.selectedDatasetId ?? datasets[0]?.dataset.id;
      this.patch({ datasets, selectedDatasetId: nextSelectedDatasetId, isLoading: false });
      if (nextSelectedDatasetId) {
        await this.selectDataset(nextSelectedDatasetId);
      }
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async selectDataset(datasetId: string | undefined): Promise<void> {
    if (!datasetId) {
      this.patch({ selectedDatasetId: undefined, selectedDataset: undefined, examples: Object.freeze([]), sourceDocuments: Object.freeze([]), validation: undefined, statistics: undefined, exports: Object.freeze([]), duplicates: Object.freeze([]) });
      return;
    }

    this.patch({ isLoading: true, error: undefined, selectedDatasetId: datasetId });
    try {
      const details = await this.service.getDatasetDetails(datasetId);
      const latestVersionId = details.latestVersion?.id;
      const examples = latestVersionId ? await this.service.listExamples({ datasetId, versionId: latestVersionId }) : [];
      const duplicates = latestVersionId ? await this.service.detectDuplicates(datasetId, latestVersionId) : [];
      const exports = latestVersionId ? await this.service.listExports(datasetId, latestVersionId) : [];
      this.patch({
        selectedDataset: details,
        selectedDatasetId: datasetId,
        sourceDocuments: Object.freeze([...details.sourceDocuments]),
        examples: Object.freeze([...examples]),
        validation: details.validation,
        statistics: details.statistics,
        exports: Object.freeze([...exports]),
        duplicates: Object.freeze([...duplicates]),
        isLoading: false,
      });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public setActiveWorkspaceTab(tab: TuningDatasetStoreState["activeWorkspaceTab"]): void {
    this.patch({ activeWorkspaceTab: tab });
  }

  public async createDataset(params: { name: string; description?: string; taskType: "question_answering" | "chat_completion" | "instruction_response" | "classification" | "extraction" | "preference" | "tool_calling"; tags?: ReadonlyArray<string>; createdBy: string }): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      const details = await this.service.createDataset({ ...params, initializeVersion: true });
      this.patch({ isMutating: false });
      await this.refreshDatasets(details.dataset.id);
      this.setActiveWorkspaceTab("overview");
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async importSources(datasetId: string, versionId: string, createdBy: string, documents: ReadonlyArray<{ name: string; content: string }>): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.importSourceDocuments({ datasetId, versionId, createdBy, documents });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("sources");
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async generateQaExamples(datasetId: string, versionId: string, createdBy: string, sourceDocumentIds: ReadonlyArray<string>): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.generateQaExamples({ datasetId, versionId, createdBy, sourceDocumentIds });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("examples");
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updateExample(datasetId: string, versionId: string, exampleId: string, updates: { question?: string; answer?: string; context?: string; split?: "train" | "validation" | "test"; status?: "draft" | "accepted" | "rejected" | "needs_review"; tags?: ReadonlyArray<string>; annotationNote?: string; updatedBy: string }): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.updateExample({ datasetId, versionId, exampleId, ...updates });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId);
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
      await this.selectDataset(datasetId);
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
      await this.selectDataset(datasetId);
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
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("validation");
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
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("splits");
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updateSplit(datasetId: string, versionId: string, exampleId: string, split: "train" | "validation" | "test", actor: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });
    try {
      await this.service.updateSplitAssignment(datasetId, versionId, exampleId, split, actor);
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId);
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
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("versions");
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async exportVersion(datasetId: string, versionId: string, format: "canonical_json" | "canonical_jsonl" | "qa_jsonl"): Promise<DatasetExportArtifact> {
    this.patch({ isMutating: true, error: undefined });
    try {
      const artifact = await this.service.exportDatasetVersion({ datasetId, versionId, format });
      this.patch({ isMutating: false });
      await this.selectDataset(datasetId);
      this.setActiveWorkspaceTab("exports");
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
      sourceDocuments: patch.sourceDocuments ?? this.state.sourceDocuments,
      exports: patch.exports ?? this.state.exports,
      duplicates: patch.duplicates ?? this.state.duplicates,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
