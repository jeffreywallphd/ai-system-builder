import type {
  Dataset,
  DatasetExample,
  DatasetExportArtifact,
  DatasetStatistics,
  DatasetStatus,
  DatasetTaskType,
  DatasetValidationResult,
  DatasetVersion,
  ExampleStatus,
  ExportFormat,
  SplitType,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { QuestionAnsweringExample, SourceDocumentReference } from "../../domain/tuning-datasets/TuningDatasetEntities";

export interface DatasetSummary {
  readonly dataset: Dataset;
  readonly latestVersion?: DatasetVersion;
  readonly statistics?: DatasetStatistics;
  readonly exampleCount: number;
}

export interface DatasetDetails {
  readonly dataset: Dataset;
  readonly versions: ReadonlyArray<DatasetVersion>;
  readonly latestVersion?: DatasetVersion;
  readonly sourceDocuments: ReadonlyArray<SourceDocumentReference>;
  readonly statistics?: DatasetStatistics;
  readonly validation?: DatasetValidationResult;
  readonly exports: ReadonlyArray<DatasetExportArtifact>;
}

export interface ExampleListItem {
  readonly example: QuestionAnsweringExample;
  readonly validationSummary: {
    readonly issueCount: number;
    readonly blockingIssueCount: number;
  };
}

export interface CreateDatasetCommand {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly taskType: DatasetTaskType;
  readonly tags?: ReadonlyArray<string>;
  readonly createdBy: string;
  readonly initializeVersion?: boolean;
}

export interface CreateDatasetVersionCommand {
  readonly datasetId: string;
  readonly createdBy: string;
}

export interface ReleaseDatasetVersionCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly releaseNotes?: string;
}

export interface ArchiveDatasetCommand {
  readonly datasetId: string;
}

export interface ListDatasetsQuery {
  readonly taskType?: DatasetTaskType;
  readonly status?: DatasetStatus;
  readonly query?: string;
  readonly limit?: number;
}

export interface GetDatasetDetailsQuery {
  readonly datasetId: string;
}

export interface AddExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly question: string;
  readonly answer: string;
  readonly context: string;
  readonly sourceDocumentId?: string;
  readonly split?: SplitType;
  readonly status?: ExampleStatus;
  readonly tags?: ReadonlyArray<string>;
  readonly createdBy: string;
}

export interface UpdateExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
  readonly question?: string;
  readonly answer?: string;
  readonly context?: string;
  readonly split?: SplitType;
  readonly status?: ExampleStatus;
  readonly tags?: ReadonlyArray<string>;
  readonly annotationNote?: string;
  readonly updatedBy: string;
}

export interface DeleteExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
}

export interface BulkAddExamplesCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly createdBy: string;
  readonly examples: ReadonlyArray<Omit<AddExampleCommand, "datasetId" | "versionId" | "createdBy">>;
}

export interface BulkUpdateExampleStatusCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleIds: ReadonlyArray<string>;
  readonly status: ExampleStatus;
  readonly updatedBy: string;
  readonly annotationNote?: string;
}

export interface ListExamplesQuery {
  readonly datasetId: string;
  readonly versionId: string;
  readonly search?: string;
  readonly status?: ExampleStatus;
  readonly split?: SplitType;
}

export interface GetExampleDetailsQuery {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
}

export interface ImportSourceDocumentsCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly createdBy: string;
  readonly documents: ReadonlyArray<{
    readonly id?: string;
    readonly name: string;
    readonly content: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

export interface GenerateQaExamplesFromSourceCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly createdBy: string;
  readonly sourceDocumentIds: ReadonlyArray<string>;
}

export interface RegenerateQaExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
  readonly updatedBy: string;
}

export interface ValidateDatasetVersionCommand {
  readonly datasetId: string;
  readonly versionId: string;
}

export interface ReviewExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
  readonly status: ExampleStatus;
  readonly reviewer: string;
  readonly note?: string;
}

export interface AssignSplitsAutomaticallyCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly actor: string;
}

export interface UpdateSplitAssignmentCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
  readonly split: SplitType;
  readonly actor: string;
}

export interface ExportDatasetVersionCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly format: ExportFormat;
}
