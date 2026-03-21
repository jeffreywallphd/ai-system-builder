export const DATASET_TASK_TYPES = Object.freeze([
  "chat_completion",
  "instruction_response",
  "question_answering",
  "classification",
  "extraction",
  "preference",
  "tool_calling",
] as const);
export type DatasetTaskType = (typeof DATASET_TASK_TYPES)[number];

export const DATASET_STATUSES = Object.freeze([
  "draft",
  "in_review",
  "validated",
  "released",
  "archived",
] as const);
export type DatasetStatus = (typeof DATASET_STATUSES)[number];

export const EXAMPLE_STATUSES = Object.freeze([
  "draft",
  "accepted",
  "rejected",
  "needs_review",
] as const);
export type ExampleStatus = (typeof EXAMPLE_STATUSES)[number];

export const SPLIT_TYPES = Object.freeze(["train", "validation", "test"] as const);
export type SplitType = (typeof SPLIT_TYPES)[number];

export const VALIDATION_SEVERITIES = Object.freeze(["error", "warning", "info"] as const);
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export const EXPORT_FORMATS = Object.freeze([
  "canonical_json",
  "canonical_jsonl",
  "openai_chat_jsonl",
  "instruction_jsonl",
  "qa_jsonl",
  "huggingface_jsonl",
  "archive_bundle",
] as const);
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface DatasetLineage {
  readonly sourceDocumentId?: string;
  readonly generatedFromExampleId?: string;
  readonly generationMethod: string;
  readonly promptTemplateVersion?: string;
  readonly capturedAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DatasetSplitAssignment {
  readonly exampleId: string;
  readonly split: SplitType;
  readonly assignedAt: Date;
  readonly assignedBy: string;
}

export interface DatasetSchema {
  readonly taskType: DatasetTaskType;
  readonly schemaVersion: string;
  readonly canonicalExampleType: string;
  readonly requiredFields: ReadonlyArray<string>;
}

export interface DatasetValidationIssue {
  readonly id: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly exampleId?: string;
  readonly field?: string;
}

export interface DatasetValidationResult {
  readonly datasetId: string;
  readonly versionId: string;
  readonly validatedAt: Date;
  readonly issues: ReadonlyArray<DatasetValidationIssue>;
  readonly isValid: boolean;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
}

export interface DatasetExportArtifact {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly format: ExportFormat;
  readonly fileName: string;
  readonly contentType: string;
  readonly content: string;
  readonly byteLength: number;
  readonly checksum: string;
  readonly createdAt: Date;
}

export interface DatasetStatistics {
  readonly datasetId: string;
  readonly versionId: string;
  readonly exampleCount: number;
  readonly sourceDocumentCount: number;
  readonly duplicateCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly draftCount: number;
  readonly needsReviewCount: number;
  readonly splitCounts: Readonly<Record<SplitType, number>>;
  readonly averageQuestionLength: number;
  readonly averageAnswerLength: number;
  readonly averageContextLength: number;
}

export interface DatasetExample {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetTaskType;
  readonly split: SplitType;
  readonly status: ExampleStatus;
  readonly tags: ReadonlyArray<string>;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lineage: DatasetLineage;
  readonly validationIssues: ReadonlyArray<DatasetValidationIssue>;
  readonly annotations: ReadonlyArray<{
    readonly id: string;
    readonly author: string;
    readonly note: string;
    readonly createdAt: Date;
  }>;
}

export interface DatasetVersion {
  readonly id: string;
  readonly datasetId: string;
  readonly versionNumber: number;
  readonly status: DatasetStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly releasedAt?: Date;
  readonly releaseNotes?: string;
  readonly validationResult?: DatasetValidationResult;
  readonly statistics?: DatasetStatistics;
  readonly schema: DatasetSchema;
  readonly isMutable: boolean;
}

export interface Dataset {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly taskType: DatasetTaskType;
  readonly status: DatasetStatus;
  readonly tags: ReadonlyArray<string>;
  readonly latestVersionId?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt?: Date;
}

export interface DatasetFactory {
  createDataset(params: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly taskType: DatasetTaskType;
    readonly tags?: ReadonlyArray<string>;
    readonly createdBy: string;
    readonly createdAt?: Date;
  }): Dataset;

  createVersion(params: {
    readonly id: string;
    readonly datasetId: string;
    readonly taskType: DatasetTaskType;
    readonly versionNumber: number;
    readonly createdBy: string;
    readonly createdAt?: Date;
  }): DatasetVersion;
}

export interface DatasetRepository {
  save(dataset: Dataset): Promise<Dataset>;
  load(id: string): Promise<Dataset | undefined>;
  list(criteria?: {
    readonly taskType?: DatasetTaskType;
    readonly status?: DatasetStatus;
    readonly query?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<Dataset>>;
}

export interface DatasetVersionRepository {
  saveVersion(version: DatasetVersion): Promise<DatasetVersion>;
  loadVersion(datasetId: string, versionId: string): Promise<DatasetVersion | undefined>;
  listVersions(datasetId: string): Promise<ReadonlyArray<DatasetVersion>>;
  saveExample(example: DatasetExample): Promise<DatasetExample>;
  deleteExample(datasetId: string, versionId: string, exampleId: string): Promise<void>;
  loadExample(datasetId: string, versionId: string, exampleId: string): Promise<DatasetExample | undefined>;
  listExamples(criteria: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly search?: string;
    readonly status?: ExampleStatus;
    readonly split?: SplitType;
  }): Promise<ReadonlyArray<DatasetExample>>;
  saveSourceDocument(document: {
    readonly id: string;
    readonly datasetId: string;
    readonly versionId: string;
    readonly name: string;
    readonly content: string;
    readonly createdBy: string;
    readonly createdAt: Date;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  listSourceDocuments(datasetId: string, versionId: string): Promise<ReadonlyArray<{
    readonly id: string;
    readonly datasetId: string;
    readonly versionId: string;
    readonly name: string;
    readonly content: string;
    readonly createdBy: string;
    readonly createdAt: Date;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>>;
  saveValidationResult(result: DatasetValidationResult): Promise<DatasetValidationResult>;
  loadValidationResult(datasetId: string, versionId: string): Promise<DatasetValidationResult | undefined>;
  saveExportArtifact(artifact: DatasetExportArtifact): Promise<DatasetExportArtifact>;
  listExportArtifacts(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>>;
}

export interface DatasetValidationService {
  validateVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
  }): DatasetValidationResult;
}

export interface DatasetSplitService {
  assign(examples: ReadonlyArray<DatasetExample>, actor: string): ReadonlyArray<DatasetExample>;
}

export interface DatasetExportService {
  exportVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly sourceDocuments: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly content: string;
    }>;
    readonly format: ExportFormat;
    readonly manifest: { readonly id: string; readonly createdAt: Date; readonly checksum: string; readonly metadata: Readonly<Record<string, unknown>> };
  }): DatasetExportArtifact;
}

export interface DatasetImportService {
  importSourceDocuments(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly createdBy: string;
    readonly documents: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly content: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }>;
  }): ReadonlyArray<{
    readonly id: string;
    readonly datasetId: string;
    readonly versionId: string;
    readonly name: string;
    readonly content: string;
    readonly createdBy: string;
    readonly createdAt: Date;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

export interface DatasetGenerationService {
  generateQuestionAnsweringExamples(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly createdBy: string;
    readonly sourceDocuments: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly content: string;
    }>;
    readonly existingExamples: ReadonlyArray<DatasetExample>;
  }): ReadonlyArray<DatasetExample>;
}

export interface DatasetReviewPolicy {
  canTransition(currentStatus: ExampleStatus, nextStatus: ExampleStatus): boolean;
}

export interface DatasetDuplicationPolicy {
  detectDuplicates(examples: ReadonlyArray<DatasetExample>): ReadonlyArray<{
    readonly fingerprint: string;
    readonly exampleIds: ReadonlyArray<string>;
  }>;
}

export interface DatasetPrivacyPolicy {
  sanitizeSourceText(value: string): string;
}
