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

export const DATASET_VERSION_KINDS = Object.freeze([
  "initial_draft",
  "successor_draft",
  "branch_draft",
  "released_snapshot",
] as const);
export type DatasetVersionKind = (typeof DATASET_VERSION_KINDS)[number];

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

export const DATASET_WORKFLOW_STAGES = Object.freeze([
  "dataset_definition",
  "source_ingestion",
  "example_generation",
  "review_editing",
  "validation",
  "split_assignment",
  "release",
  "export",
] as const);
export type DatasetWorkflowStage = (typeof DATASET_WORKFLOW_STAGES)[number];

export const WORKFLOW_STAGE_STATUSES = Object.freeze(["pending", "current", "completed", "blocked"] as const);
export type WorkflowStageStatus = (typeof WORKFLOW_STAGE_STATUSES)[number];

export const SOURCE_INPUT_TYPES = Object.freeze(["manual_text", "uploaded_text", "uploaded_file"] as const);
export type SourceInputType = (typeof SOURCE_INPUT_TYPES)[number];

export const SOURCE_SEGMENT_KINDS = Object.freeze(["document", "paragraph", "sentence"] as const);
export type SourceSegmentKind = (typeof SOURCE_SEGMENT_KINDS)[number];

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

export const CHAT_MESSAGE_ROLES = Object.freeze(["system", "user", "assistant"] as const);
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export interface DatasetGenerationDiagnostic {
  readonly code: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
}

export type DatasetGenerationMode = "provider-model-backed" | "runtime-local-deterministic" | "heuristic-fallback";
export type DatasetGenerationStatus = "completed" | "partial" | "failed";

export interface DatasetGenerationFallback {
  readonly fromMode?: DatasetGenerationMode;
  readonly reason: string;
}

export interface DatasetGenerationProvenance {
  readonly provider: string;
  readonly modelId?: string;
  readonly modelDisplayName?: string;
  readonly generatorId: string;
  readonly generatorVersion: string;
  readonly batchId: string;
  readonly mode: DatasetGenerationMode;
  readonly status: DatasetGenerationStatus;
  readonly detail?: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly startedAt: Date;
  readonly executedAt: Date;
  readonly durationMs?: number;
  readonly diagnostics: ReadonlyArray<DatasetGenerationDiagnostic>;
  readonly fallback?: DatasetGenerationFallback;
}

export interface DatasetGenerationBatch {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetTaskType;
  readonly generatedAt: Date;
  readonly generatedCount: number;
  readonly skippedCount: number;
  readonly status: DatasetGenerationStatus;
  readonly provenance: DatasetGenerationProvenance;
  readonly exampleIds: ReadonlyArray<string>;
}

export interface DatasetLineage {
  readonly sourceDocumentId?: string;
  readonly generatedFromExampleId?: string;
  readonly generationMethod: string;
  readonly promptTemplateVersion?: string;
  readonly capturedAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly generator?: DatasetGenerationProvenance;
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
  readonly stage?: DatasetWorkflowStage;
}

export interface DatasetReleaseReadiness {
  readonly isReady: boolean;
  readonly reviewReady: boolean;
  readonly splitReady: boolean;
  readonly exportReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface DatasetValidationResult {
  readonly datasetId: string;
  readonly versionId: string;
  readonly validatedAt: Date;
  readonly issues: ReadonlyArray<DatasetValidationIssue>;
  readonly isValid: boolean;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly readiness: DatasetReleaseReadiness;
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
  readonly averageMessageCount: number;
}

export interface DatasetExampleAnnotation {
  readonly id: string;
  readonly author: string;
  readonly note: string;
  readonly createdAt: Date;
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
  readonly annotations: ReadonlyArray<DatasetExampleAnnotation>;
}

export interface ChatCompletionMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
}

export interface DatasetVersion {
  readonly id: string;
  readonly datasetId: string;
  readonly versionNumber: number;
  readonly status: DatasetStatus;
  readonly kind: DatasetVersionKind;
  readonly parentVersionId?: string;
  readonly sourceVersionId?: string;
  readonly comparisonLabel?: string;
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

export interface DatasetWorkflowStageState {
  readonly stage: DatasetWorkflowStage;
  readonly status: WorkflowStageStatus;
}

export interface DatasetWorkflowState {
  readonly datasetId: string;
  readonly versionId: string;
  readonly currentStage: DatasetWorkflowStage;
  readonly completedStages: ReadonlyArray<DatasetWorkflowStage>;
  readonly stageStates: ReadonlyArray<DatasetWorkflowStageState>;
  readonly progressPercent: number;
  readonly lastVisitedStage: DatasetWorkflowStage;
  readonly updatedAt: Date;
}

export interface Dataset {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly taskType: DatasetTaskType;
  readonly status: DatasetStatus;
  readonly tags: ReadonlyArray<string>;
  readonly latestVersionId?: string;
  readonly selectedVersionId?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt?: Date;
}

export interface DatasetVersionComparison {
  readonly versionId: string;
  readonly comparedToVersionId?: string;
  readonly derivedFromVersionId?: string;
  readonly exampleDelta: number;
  readonly sourceDocumentDelta: number;
  readonly changedAt: Date;
}

export interface DatasetSourceSegment {
  readonly id: string;
  readonly sourceDocumentId: string;
  readonly index: number;
  readonly kind: SourceSegmentKind;
  readonly text: string;
  readonly checksum: string;
}

export interface DatasetSourceDocument {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly name: string;
  readonly content: string;
  readonly normalizedContent: string;
  readonly checksum: string;
  readonly sourceType: SourceInputType;
  readonly mediaType: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly segments: ReadonlyArray<DatasetSourceSegment>;
  readonly metadata?: Readonly<Record<string, unknown>>;
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
    readonly kind?: DatasetVersionKind;
    readonly parentVersionId?: string;
    readonly sourceVersionId?: string;
    readonly comparisonLabel?: string;
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
  saveSourceDocument(document: DatasetSourceDocument): Promise<void>;
  listSourceDocuments(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetSourceDocument>>;
  saveValidationResult(result: DatasetValidationResult): Promise<DatasetValidationResult>;
  loadValidationResult(datasetId: string, versionId: string): Promise<DatasetValidationResult | undefined>;
  saveGenerationBatch(batch: DatasetGenerationBatch): Promise<DatasetGenerationBatch>;
  listGenerationBatches(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetGenerationBatch>>;
  saveExportArtifact(artifact: DatasetExportArtifact): Promise<DatasetExportArtifact>;
  listExportArtifacts(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>>;
  saveWorkflowState(workflow: DatasetWorkflowState): Promise<DatasetWorkflowState>;
  loadWorkflowState(datasetId: string, versionId: string): Promise<DatasetWorkflowState | undefined>;
}

export interface DatasetValidationService {
  validateVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly sourceDocuments: ReadonlyArray<DatasetSourceDocument>;
  }): DatasetValidationResult;
}

export interface DatasetSplitService {
  assign(examples: ReadonlyArray<DatasetExample>, actor: string): ReadonlyArray<DatasetExample>;
}

export interface DatasetReleasePolicy {
  evaluate(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly validation?: DatasetValidationResult;
  }): DatasetReleaseReadiness;
}

export interface DatasetWorkflowService {
  createInitial(datasetId: string, versionId: string): DatasetWorkflowState;
  transition(workflow: DatasetWorkflowState, nextStage: DatasetWorkflowStage): DatasetWorkflowState;
  reconcile(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly current?: DatasetWorkflowState;
    readonly hasDefinition: boolean;
    readonly sourceCount: number;
    readonly exampleCount: number;
    readonly validation?: DatasetValidationResult;
    readonly version: DatasetVersion;
    readonly exportCount: number;
  }): DatasetWorkflowState;
}

export interface DatasetExportService {
  exportVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly sourceDocuments: ReadonlyArray<DatasetSourceDocument>;
    readonly format: ExportFormat;
    readonly manifest: { readonly id: string; readonly createdAt: Date; readonly checksum: string; readonly metadata: Readonly<Record<string, unknown>> };
  }): DatasetExportArtifact;
}

export interface SourceImportDocumentInput {
  readonly id?: string;
  readonly name: string;
  readonly content: string;
  readonly sourceType?: SourceInputType;
  readonly mediaType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SourceImportRequest {
  readonly datasetId: string;
  readonly versionId: string;
  readonly createdBy: string;
  readonly documents: ReadonlyArray<SourceImportDocumentInput>;
}

export interface SourceImportResult {
  readonly documents: ReadonlyArray<DatasetSourceDocument>;
  readonly importedCount: number;
  readonly duplicateCount: number;
}

export interface DatasetImportService {
  importSourceDocuments(params: SourceImportRequest): SourceImportResult;
}

export interface DatasetGenerationConfiguration {
  readonly strategy: string;
  readonly maxExamplesPerSource?: number;
  readonly maxSegmentsPerSource?: number;
  readonly provider?: string;
  readonly model?: string;
}

export interface DatasetGenerationRequest {
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetTaskType;
  readonly createdBy: string;
  readonly sourceDocuments: ReadonlyArray<DatasetSourceDocument>;
  readonly existingExamples: ReadonlyArray<DatasetExample>;
  readonly configuration?: DatasetGenerationConfiguration;
}

export interface DatasetGenerationResult {
  readonly batchId: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetTaskType;
  readonly generatedAt: Date;
  readonly examples: ReadonlyArray<DatasetExample>;
  readonly provenance: DatasetGenerationProvenance;
  readonly generatedCount: number;
  readonly skippedCount: number;
  readonly status: DatasetGenerationStatus;
}

export interface DatasetGenerationService {
  generate(request: DatasetGenerationRequest): Promise<DatasetGenerationResult>;
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
