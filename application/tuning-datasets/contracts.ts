import type {
  ChatCompletionMessage,
  Dataset,
  DatasetExample,
  DatasetExportArtifact,
  DatasetGenerationConfiguration,
  DatasetSourceDocument,
  DatasetStatistics,
  DatasetStatus,
  DatasetTaskType,
  DatasetValidationResult,
  DatasetVersion,
  DatasetWorkflowStage,
  DatasetWorkflowState,
  ExampleStatus,
  ExportFormat,
  SplitType,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";

export interface DatasetSummary {
  readonly dataset: Dataset;
  readonly latestVersion?: DatasetVersion;
  readonly selectedVersion?: DatasetVersion;
  readonly statistics?: DatasetStatistics;
  readonly exampleCount: number;
}

export interface DatasetDetails {
  readonly dataset: Dataset;
  readonly versions: ReadonlyArray<DatasetVersion>;
  readonly latestVersion?: DatasetVersion;
  readonly selectedVersion?: DatasetVersion;
  readonly sourceDocuments: ReadonlyArray<DatasetSourceDocument>;
  readonly statistics?: DatasetStatistics;
  readonly validation?: DatasetValidationResult;
  readonly exports: ReadonlyArray<DatasetExportArtifact>;
  readonly workflow: DatasetWorkflowState;
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

export interface CreateSuccessorDatasetVersionCommand {
  readonly datasetId: string;
  readonly releasedVersionId: string;
  readonly createdBy: string;
  readonly cloneExamples?: boolean;
  readonly cloneSources?: boolean;
}

export interface SelectDatasetVersionCommand {
  readonly datasetId: string;
  readonly versionId: string;
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
  readonly versionId?: string;
}

export interface AddQuestionAnsweringExampleCommand {
  readonly taskType: "question_answering";
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

export interface AddChatCompletionExampleCommand {
  readonly taskType: "chat_completion";
  readonly datasetId: string;
  readonly versionId: string;
  readonly messages: ReadonlyArray<ChatCompletionMessage>;
  readonly split?: SplitType;
  readonly status?: ExampleStatus;
  readonly tags?: ReadonlyArray<string>;
  readonly createdBy: string;
}

export type AddExampleCommand = AddQuestionAnsweringExampleCommand | AddChatCompletionExampleCommand;

export interface UpdateQuestionAnsweringExampleCommand {
  readonly taskType?: "question_answering";
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

export interface UpdateChatCompletionExampleCommand {
  readonly taskType?: "chat_completion";
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
  readonly messages?: ReadonlyArray<ChatCompletionMessage>;
  readonly split?: SplitType;
  readonly status?: ExampleStatus;
  readonly tags?: ReadonlyArray<string>;
  readonly annotationNote?: string;
  readonly updatedBy: string;
}

export type UpdateExampleCommand = UpdateQuestionAnsweringExampleCommand | UpdateChatCompletionExampleCommand;

export interface DeleteExampleCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleId: string;
}

export interface BulkUpdateExamplesCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleIds: ReadonlyArray<string>;
  readonly status?: ExampleStatus;
  readonly split?: SplitType;
  readonly annotationNote?: string;
  readonly updatedBy: string;
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
    readonly sourceType?: "manual_text" | "uploaded_text" | "uploaded_file";
    readonly mediaType?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

export interface GenerateExamplesFromSourceCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly createdBy: string;
  readonly sourceDocumentIds: ReadonlyArray<string>;
  readonly configuration?: DatasetGenerationConfiguration;
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

export interface MoveWorkflowStageCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly stage: DatasetWorkflowStage;
}

export interface ExportDatasetVersionCommand {
  readonly datasetId: string;
  readonly versionId: string;
  readonly format: ExportFormat;
}

export type StudioExample = DatasetExample;
