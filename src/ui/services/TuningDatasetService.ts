import type {
  DatasetExportArtifact,
  DatasetSourceDocument,
  DatasetWorkflowStage,
  ExportFormat,
  SplitType,
} from "../../src/domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  AddExampleCommand,
  BulkUpdateExamplesCommand,
  CreateDatasetCommand,
  DatasetDetails,
  DatasetSummary,
  ExportDatasetVersionCommand,
  GenerateExamplesFromSourceCommand,
  ListExamplesQuery,
  StudioExample,
  UpdateExampleCommand,
} from "../../application/tuning-datasets/contracts";
import type { TuningDatasetStudioApplicationService } from "../../application/tuning-datasets/TuningDatasetStudioApplicationService";

export class TuningDatasetService {
  constructor(private readonly applicationService: TuningDatasetStudioApplicationService) {}

  public listDatasets(): Promise<ReadonlyArray<DatasetSummary>> {
    return this.applicationService.listDatasets();
  }

  public getDatasetDetails(datasetId: string, versionId?: string): Promise<DatasetDetails> {
    return this.applicationService.getDatasetDetails({ datasetId, versionId });
  }

  public createDataset(command: CreateDatasetCommand): Promise<DatasetDetails> {
    return this.applicationService.createDataset(command);
  }

  public createDatasetVersion(datasetId: string, createdBy: string) {
    return this.applicationService.createDatasetVersion({ datasetId, createdBy });
  }

  public createSuccessorDatasetVersion(datasetId: string, releasedVersionId: string, createdBy: string) {
    return this.applicationService.createSuccessorDatasetVersion({ datasetId, releasedVersionId, createdBy, cloneExamples: true, cloneSources: true });
  }

  public selectDatasetVersion(datasetId: string, versionId: string) {
    return this.applicationService.selectDatasetVersion({ datasetId, versionId });
  }

  public importSourceDocuments(command: import("../../application/tuning-datasets/contracts").ImportSourceDocumentsCommand): Promise<ReadonlyArray<DatasetSourceDocument>> {
    return this.applicationService.importSourceDocuments(command);
  }

  public ingestSourceFiles(command: import("../../application/tuning-datasets/contracts").IngestDatasetSourceFilesCommand): Promise<ReadonlyArray<DatasetSourceDocument>> {
    return this.applicationService.ingestSourceFiles(command);
  }

  public generateExamples(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<StudioExample>> {
    return this.applicationService.generateExamplesFromSource(command);
  }

  public listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<StudioExample>> {
    return this.applicationService.listExamples(query);
  }

  public addExample(command: AddExampleCommand): Promise<StudioExample> {
    return this.applicationService.addExample(command);
  }

  public updateExample(command: UpdateExampleCommand): Promise<StudioExample> {
    return this.applicationService.updateExample(command);
  }

  public deleteExample(datasetId: string, versionId: string, exampleId: string): Promise<void> {
    return this.applicationService.deleteExample({ datasetId, versionId, exampleId });
  }

  public bulkUpdateExamples(command: BulkUpdateExamplesCommand): Promise<ReadonlyArray<StudioExample>> {
    return this.applicationService.bulkUpdateExamples(command);
  }

  public validateDatasetVersion(datasetId: string, versionId: string) {
    return this.applicationService.validateDatasetVersion({ datasetId, versionId });
  }

  public assignSplits(datasetId: string, versionId: string, actor: string) {
    return this.applicationService.assignSplitsAutomatically({ datasetId, versionId, actor });
  }

  public updateSplitAssignment(datasetId: string, versionId: string, exampleId: string, split: SplitType, actor: string) {
    return this.applicationService.updateSplitAssignment({ datasetId, versionId, exampleId, split, actor });
  }

  public reviewExample(datasetId: string, versionId: string, exampleId: string, status: "accepted" | "rejected" | "needs_review", reviewer: string, note?: string) {
    return this.applicationService.reviewExample({ datasetId, versionId, exampleId, status, reviewer, note });
  }

  public loadWorkflow(datasetId: string, versionId: string) {
    return this.applicationService.loadWorkflow(datasetId, versionId);
  }

  public moveWorkflowStage(datasetId: string, versionId: string, stage: DatasetWorkflowStage) {
    return this.applicationService.moveWorkflowStage({ datasetId, versionId, stage });
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
