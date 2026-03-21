import type { QuestionAnsweringExample, SourceDocumentReference } from "../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  DatasetExportArtifact,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetVersion,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  AddExampleCommand,
  ArchiveDatasetCommand,
  AssignSplitsAutomaticallyCommand,
  BulkAddExamplesCommand,
  BulkUpdateExampleStatusCommand,
  CreateDatasetCommand,
  CreateDatasetVersionCommand,
  DatasetDetails,
  DatasetSummary,
  DeleteExampleCommand,
  ExportDatasetVersionCommand,
  GenerateQaExamplesFromSourceCommand,
  GetDatasetDetailsQuery,
  GetExampleDetailsQuery,
  ImportSourceDocumentsCommand,
  ListDatasetsQuery,
  ListExamplesQuery,
  RegenerateQaExampleCommand,
  ReleaseDatasetVersionCommand,
  ReviewExampleCommand,
  UpdateExampleCommand,
  UpdateSplitAssignmentCommand,
  ValidateDatasetVersionCommand,
} from "./contracts";

export interface TuningDatasetStudioApplicationService {
  createDataset(command: CreateDatasetCommand): Promise<DatasetDetails>;
  createDatasetVersion(command: CreateDatasetVersionCommand): Promise<DatasetVersion>;
  releaseDatasetVersion(command: ReleaseDatasetVersionCommand): Promise<DatasetVersion>;
  archiveDataset(command: ArchiveDatasetCommand): Promise<DatasetDetails>;
  listDatasets(query?: ListDatasetsQuery): Promise<ReadonlyArray<DatasetSummary>>;
  getDatasetDetails(query: GetDatasetDetailsQuery): Promise<DatasetDetails>;

  addExample(command: AddExampleCommand): Promise<QuestionAnsweringExample>;
  updateExample(command: UpdateExampleCommand): Promise<QuestionAnsweringExample>;
  deleteExample(command: DeleteExampleCommand): Promise<void>;
  bulkAddExamples(command: BulkAddExamplesCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  bulkUpdateExampleStatus(command: BulkUpdateExampleStatusCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  getExampleDetails(query: GetExampleDetailsQuery): Promise<QuestionAnsweringExample | undefined>;

  importSourceDocuments(command: ImportSourceDocumentsCommand): Promise<ReadonlyArray<SourceDocumentReference>>;
  generateQaExamplesFromSource(command: GenerateQaExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  regenerateQaExample(command: RegenerateQaExampleCommand): Promise<QuestionAnsweringExample>;
  transformSourceToQaExamples(command: GenerateQaExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;

  validateDatasetVersion(command: ValidateDatasetVersionCommand): Promise<DatasetValidationResult>;
  reviewExample(command: ReviewExampleCommand): Promise<QuestionAnsweringExample>;
  acceptExample(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample>;
  rejectExample(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample>;
  markExampleNeedsReview(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample>;
  detectDuplicates(datasetId: string, versionId: string): Promise<ReadonlyArray<{ fingerprint: string; exampleIds: ReadonlyArray<string> }>>;
  computeDatasetStatistics(datasetId: string, versionId: string): Promise<DatasetStatistics>;

  assignSplitsAutomatically(command: AssignSplitsAutomaticallyCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  updateSplitAssignment(command: UpdateSplitAssignmentCommand): Promise<QuestionAnsweringExample>;

  exportDatasetVersion(command: ExportDatasetVersionCommand): Promise<DatasetExportArtifact>;
  listExports(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>>;
}
