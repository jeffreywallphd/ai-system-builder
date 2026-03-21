import type { DatasetExportArtifact } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { QuestionAnsweringExample, SourceDocumentReference } from "../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  CreateDatasetCommand,
  DatasetDetails,
  DatasetSummary,
  ExportDatasetVersionCommand,
  GenerateQaExamplesFromSourceCommand,
  ImportSourceDocumentsCommand,
  ListExamplesQuery,
  UpdateExampleCommand,
} from "../../application/tuning-datasets/contracts";
import type { TuningDatasetStudioApplicationService } from "../../application/tuning-datasets/TuningDatasetStudioApplicationService";

export class TuningDatasetService {
  constructor(private readonly applicationService: TuningDatasetStudioApplicationService) {}

  public listDatasets(): Promise<ReadonlyArray<DatasetSummary>> {
    return this.applicationService.listDatasets();
  }

  public getDatasetDetails(datasetId: string): Promise<DatasetDetails> {
    return this.applicationService.getDatasetDetails({ datasetId });
  }

  public createDataset(command: CreateDatasetCommand): Promise<DatasetDetails> {
    return this.applicationService.createDataset(command);
  }

  public createDatasetVersion(datasetId: string, createdBy: string) {
    return this.applicationService.createDatasetVersion({ datasetId, createdBy });
  }

  public importSourceDocuments(command: ImportSourceDocumentsCommand): Promise<ReadonlyArray<SourceDocumentReference>> {
    return this.applicationService.importSourceDocuments(command);
  }

  public generateQaExamples(command: GenerateQaExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    return this.applicationService.generateQaExamplesFromSource(command);
  }

  public listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    return this.applicationService.listExamples(query);
  }

  public updateExample(command: UpdateExampleCommand): Promise<QuestionAnsweringExample> {
    return this.applicationService.updateExample(command);
  }

  public deleteExample(datasetId: string, versionId: string, exampleId: string): Promise<void> {
    return this.applicationService.deleteExample({ datasetId, versionId, exampleId });
  }

  public validateDatasetVersion(datasetId: string, versionId: string) {
    return this.applicationService.validateDatasetVersion({ datasetId, versionId });
  }

  public assignSplits(datasetId: string, versionId: string, actor: string) {
    return this.applicationService.assignSplitsAutomatically({ datasetId, versionId, actor });
  }

  public updateSplitAssignment(datasetId: string, versionId: string, exampleId: string, split: "train" | "validation" | "test", actor: string) {
    return this.applicationService.updateSplitAssignment({ datasetId, versionId, exampleId, split, actor });
  }

  public reviewExample(datasetId: string, versionId: string, exampleId: string, status: "accepted" | "rejected" | "needs_review", reviewer: string, note?: string) {
    return this.applicationService.reviewExample({ datasetId, versionId, exampleId, status, reviewer, note });
  }

  public releaseDatasetVersion(datasetId: string, versionId: string, releaseNotes?: string) {
    return this.applicationService.releaseDatasetVersion({ datasetId, versionId, releaseNotes });
  }

  public exportDatasetVersion(command: ExportDatasetVersionCommand): Promise<DatasetExportArtifact> {
    return this.applicationService.exportDatasetVersion(command);
  }

  public listExports(datasetId: string, versionId: string) {
    return this.applicationService.listExports(datasetId, versionId);
  }

  public detectDuplicates(datasetId: string, versionId: string) {
    return this.applicationService.detectDuplicates(datasetId, versionId);
  }

  public computeStatistics(datasetId: string, versionId: string) {
    return this.applicationService.computeDatasetStatistics(datasetId, versionId);
  }
}
