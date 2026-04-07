import type { ChatCompletionExample, QuestionAnsweringExample } from "../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  DatasetExportArtifact,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetVersion,
  DatasetWorkflowState,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  AddExampleCommand,
  ArchiveDatasetCommand,
  AssignSplitsAutomaticallyCommand,
  BulkUpdateExamplesCommand,
  CreateDatasetCommand,
  CreateDatasetVersionCommand,
  CreateSuccessorDatasetVersionCommand,
  DatasetDetails,
  DatasetSummary,
  DeleteExampleCommand,
  ExportDatasetVersionCommand,
  GenerateExamplesFromSourceCommand,
  GetDatasetDetailsQuery,
  GetExampleDetailsQuery,
  ImportSourceDocumentsCommand,
  IngestDatasetSourceFilesCommand,
  ListDatasetsQuery,
  ListExamplesQuery,
  MoveWorkflowStageCommand,
  ReleaseDatasetVersionCommand,
  ReviewExampleCommand,
  SelectDatasetVersionCommand,
  StudioExample,
  UpdateExampleCommand,
  UpdateSplitAssignmentCommand,
  ValidateDatasetVersionCommand,
} from "./contracts";

export interface TuningDatasetStudioApplicationService {
  createDataset(command: CreateDatasetCommand): Promise<DatasetDetails>;
  createDatasetVersion(command: CreateDatasetVersionCommand): Promise<DatasetVersion>;
  createSuccessorDatasetVersion(command: CreateSuccessorDatasetVersionCommand): Promise<DatasetDetails>;
  selectDatasetVersion(command: SelectDatasetVersionCommand): Promise<DatasetDetails>;
  releaseDatasetVersion(command: ReleaseDatasetVersionCommand): Promise<DatasetVersion>;
  archiveDataset(command: ArchiveDatasetCommand): Promise<DatasetDetails>;
  listDatasets(query?: ListDatasetsQuery): Promise<ReadonlyArray<DatasetSummary>>;
  getDatasetDetails(query: GetDatasetDetailsQuery): Promise<DatasetDetails>;

  addExample(command: AddExampleCommand): Promise<StudioExample>;
  updateExample(command: UpdateExampleCommand): Promise<StudioExample>;
  deleteExample(command: DeleteExampleCommand): Promise<void>;
  bulkUpdateExamples(command: BulkUpdateExamplesCommand): Promise<ReadonlyArray<StudioExample>>;
  listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<StudioExample>>;
  getExampleDetails(query: GetExampleDetailsQuery): Promise<StudioExample | undefined>;

  importSourceDocuments(command: ImportSourceDocumentsCommand): Promise<ReadonlyArray<import("../../domain/tuning-datasets/interfaces/ITuningDatasetStudio").DatasetSourceDocument>>;
  ingestSourceFiles(command: IngestDatasetSourceFilesCommand): Promise<ReadonlyArray<import("../../domain/tuning-datasets/interfaces/ITuningDatasetStudio").DatasetSourceDocument>>;
  generateExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<StudioExample>>;
  generateQaExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>>;
  generateChatExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<ChatCompletionExample>>;

  validateDatasetVersion(command: ValidateDatasetVersionCommand): Promise<DatasetValidationResult>;
  reviewExample(command: ReviewExampleCommand): Promise<StudioExample>;
  acceptExample(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample>;
  rejectExample(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample>;
  markExampleNeedsReview(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample>;
  detectDuplicates(datasetId: string, versionId: string): Promise<ReadonlyArray<{ fingerprint: string; exampleIds: ReadonlyArray<string> }>>;
  computeDatasetStatistics(datasetId: string, versionId: string): Promise<DatasetStatistics>;

  assignSplitsAutomatically(command: AssignSplitsAutomaticallyCommand): Promise<ReadonlyArray<StudioExample>>;
  updateSplitAssignment(command: UpdateSplitAssignmentCommand): Promise<StudioExample>;

  loadWorkflow(datasetId: string, versionId: string): Promise<DatasetWorkflowState>;
  moveWorkflowStage(command: MoveWorkflowStageCommand): Promise<DatasetWorkflowState>;

  exportDatasetVersion(command: ExportDatasetVersionCommand): Promise<DatasetExportArtifact>;
  listExports(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>>;
}
