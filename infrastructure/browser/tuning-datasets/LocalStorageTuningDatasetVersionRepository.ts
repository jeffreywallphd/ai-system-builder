import {
  ChatCompletionExample,
  DatasetWorkflow,
  ExampleAnnotation,
  ExampleLineage,
  QuestionAnsweringExample,
  SourceDocumentReference,
  TuningDatasetVersion,
  ValidationIssue,
  type SourceSegmentReference,
  type DatasetExportRecord,
} from "../../../domain/tuning-datasets/TuningDatasetEntities";
import { DatasetExportRecord as DatasetExportRecordEntity } from "../../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  ChatCompletionMessage,
  DatasetExample,
  DatasetExportArtifact,
  DatasetGenerationBatch,
  DatasetGenerationProvenance,
  DatasetSourceDocument,
  DatasetSourceSegment,
  DatasetValidationResult,
  DatasetVersion,
  DatasetVersionRepository,
  DatasetWorkflowState,
  ExampleStatus,
  SplitType,
} from "../../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface VersionRecord {
  readonly id: string;
  readonly datasetId: string;
  readonly versionNumber: number;
  readonly status: DatasetVersion["status"];
  readonly kind: DatasetVersion["kind"];
  readonly parentVersionId?: string;
  readonly sourceVersionId?: string;
  readonly comparisonLabel?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly releasedAt?: string;
  readonly releaseNotes?: string;
  readonly schema: DatasetVersion["schema"] & { requiredFields: ReadonlyArray<string> };
  readonly validationResult?: SerializedValidationResult;
  readonly statistics?: DatasetVersion["statistics"];
}

interface ExampleRecord {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetExample["taskType"];
  readonly question?: string;
  readonly answer?: string;
  readonly context?: string;
  readonly sourceDocumentId?: string;
  readonly sourceOffsets?: Readonly<{ start: number; end: number }>;
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
  readonly messages?: ReadonlyArray<ChatCompletionMessage>;
  readonly split: SplitType;
  readonly status: ExampleStatus;
  readonly tags: ReadonlyArray<string>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lineage: {
    readonly sourceDocumentId?: string;
    readonly generatedFromExampleId?: string;
    readonly generationMethod: string;
    readonly promptTemplateVersion?: string;
    readonly capturedAt: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly generator?: Omit<DatasetGenerationProvenance, "startedAt" | "executedAt"> & { readonly startedAt: string; readonly executedAt: string };
  };
  readonly validationIssues: ReadonlyArray<SerializedValidationIssue>;
  readonly annotations: ReadonlyArray<{ readonly id: string; readonly author: string; readonly note: string; readonly createdAt: string }>;
}

interface SourceDocumentRecord {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly name: string;
  readonly content: string;
  readonly normalizedContent: string;
  readonly checksum: string;
  readonly sourceType: DatasetSourceDocument["sourceType"];
  readonly mediaType: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly segments: ReadonlyArray<{
    readonly id: string;
    readonly sourceDocumentId: string;
    readonly index: number;
    readonly kind: DatasetSourceSegment["kind"];
    readonly text: string;
    readonly checksum: string;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface SerializedValidationIssue {
  readonly id: string;
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly exampleId?: string;
  readonly field?: string;
  readonly stage?: import("../../../domain/tuning-datasets/interfaces/ITuningDatasetStudio").DatasetWorkflowStage;
}

interface SerializedValidationResult {
  readonly datasetId: string;
  readonly versionId: string;
  readonly validatedAt: string;
  readonly issues: ReadonlyArray<SerializedValidationIssue>;
  readonly isValid: boolean;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly readiness: {
    readonly isReady: boolean;
    readonly reviewReady: boolean;
    readonly splitReady: boolean;
    readonly exportReady: boolean;
    readonly blockingReasons: ReadonlyArray<string>;
  };
}

interface GenerationBatchRecord {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly taskType: DatasetGenerationBatch["taskType"];
  readonly generatedAt: string;
  readonly generatedCount: number;
  readonly skippedCount: number;
  readonly status: DatasetGenerationBatch["status"];
  readonly provenance: ExampleRecord["lineage"]["generator"] & { readonly batchId: string };
  readonly exampleIds: ReadonlyArray<string>;
}

interface WorkflowRecord {
  readonly datasetId: string;
  readonly versionId: string;
  readonly currentStage: DatasetWorkflowState["currentStage"];
  readonly completedStages: ReadonlyArray<DatasetWorkflowState["currentStage"]>;
  readonly stageStates: ReadonlyArray<{ readonly stage: DatasetWorkflowState["currentStage"]; readonly status: import("../../../domain/tuning-datasets/interfaces/ITuningDatasetStudio").WorkflowStageStatus }>;
  readonly progressPercent: number;
  readonly lastVisitedStage: DatasetWorkflowState["currentStage"];
  readonly updatedAt: string;
}

interface ExportRecord {
  readonly id: string;
  readonly datasetId: string;
  readonly versionId: string;
  readonly format: DatasetExportArtifact["format"];
  readonly fileName: string;
  readonly contentType: string;
  readonly content: string;
  readonly byteLength: number;
  readonly checksum: string;
  readonly createdAt: string;
}

const versionStorageKey = "ai-loom-studio.tuning-dataset-versions";
const exampleStorageKey = "ai-loom-studio.tuning-dataset-examples";
const sourceStorageKey = "ai-loom-studio.tuning-dataset-sources";
const validationStorageKey = "ai-loom-studio.tuning-dataset-validations";
const generationBatchStorageKey = "ai-loom-studio.tuning-dataset-generation-batches";
const exportStorageKey = "ai-loom-studio.tuning-dataset-exports";
const workflowStorageKey = "ai-loom-studio.tuning-dataset-workflows";

export class LocalStorageTuningDatasetVersionRepository implements DatasetVersionRepository {
  constructor(
    private readonly storage: StorageLike | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async saveVersion(version: DatasetVersion): Promise<DatasetVersion> {
    const versions = this.readCollection<VersionRecord>(versionStorageKey);
    const record = this.toVersionRecord(version);
    this.upsert(versions, record, (current) => current.id === version.id && current.datasetId === version.datasetId, versionStorageKey);
    return this.toVersion(record);
  }

  public async loadVersion(datasetId: string, versionId: string): Promise<DatasetVersion | undefined> {
    const record = this.readCollection<VersionRecord>(versionStorageKey)
      .find((entry) => entry.datasetId === datasetId && entry.id === versionId);
    return record ? this.toVersion(record) : undefined;
  }

  public async listVersions(datasetId: string): Promise<ReadonlyArray<DatasetVersion>> {
    return Object.freeze(this.readCollection<VersionRecord>(versionStorageKey)
      .filter((record) => record.datasetId === datasetId)
      .sort((left, right) => left.versionNumber - right.versionNumber)
      .map((record) => this.toVersion(record)));
  }

  public async saveExample(example: DatasetExample): Promise<DatasetExample> {
    const examples = this.readCollection<ExampleRecord>(exampleStorageKey);
    const record = this.toExampleRecord(example);
    this.upsert(examples, record, (current) => current.id === example.id && current.datasetId === example.datasetId && current.versionId === example.versionId, exampleStorageKey);
    return this.toExample(record);
  }

  public async deleteExample(datasetId: string, versionId: string, exampleId: string): Promise<void> {
    const examples = this.readCollection<ExampleRecord>(exampleStorageKey)
      .filter((record) => !(record.datasetId === datasetId && record.versionId === versionId && record.id === exampleId));
    this.writeCollection(exampleStorageKey, examples);
  }

  public async loadExample(datasetId: string, versionId: string, exampleId: string): Promise<DatasetExample | undefined> {
    const record = this.readCollection<ExampleRecord>(exampleStorageKey)
      .find((entry) => entry.datasetId === datasetId && entry.versionId === versionId && entry.id === exampleId);
    return record ? this.toExample(record) : undefined;
  }

  public async listExamples(criteria: { readonly datasetId: string; readonly versionId: string; readonly search?: string; readonly status?: ExampleStatus; readonly split?: SplitType }): Promise<ReadonlyArray<DatasetExample>> {
    const query = criteria.search?.trim().toLowerCase();
    return Object.freeze(this.readCollection<ExampleRecord>(exampleStorageKey)
      .filter((record) => record.datasetId === criteria.datasetId && record.versionId === criteria.versionId)
      .filter((record) => !criteria.status || record.status === criteria.status)
      .filter((record) => !criteria.split || record.split === criteria.split)
      .filter((record) => !query || [record.question, record.answer, record.context, ...(record.messages?.map((message) => message.content) ?? [])].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => this.toExample(record)));
  }

  public async saveSourceDocument(document: DatasetSourceDocument): Promise<void> {
    const sources = this.readCollection<SourceDocumentRecord>(sourceStorageKey);
    const record = this.toSourceRecord(document);
    this.upsert(sources, record, (current) => current.id === document.id && current.datasetId === document.datasetId && current.versionId === document.versionId, sourceStorageKey);
  }

  public async listSourceDocuments(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetSourceDocument>> {
    return Object.freeze(this.readCollection<SourceDocumentRecord>(sourceStorageKey)
      .filter((record) => record.datasetId === datasetId && record.versionId === versionId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((record) => this.toSourceDocument(record)));
  }

  public async saveValidationResult(result: DatasetValidationResult): Promise<DatasetValidationResult> {
    const validations = this.readCollection<SerializedValidationResult>(validationStorageKey);
    const serialized = this.toValidationRecord(result);
    this.upsert(validations, serialized, (current) => current.datasetId === result.datasetId && current.versionId === result.versionId, validationStorageKey);
    return this.toValidationResult(serialized);
  }

  public async loadValidationResult(datasetId: string, versionId: string): Promise<DatasetValidationResult | undefined> {
    const record = this.readCollection<SerializedValidationResult>(validationStorageKey)
      .find((entry) => entry.datasetId === datasetId && entry.versionId === versionId);
    return record ? this.toValidationResult(record) : undefined;
  }

  public async saveGenerationBatch(batch: DatasetGenerationBatch): Promise<DatasetGenerationBatch> {
    const batches = this.readCollection<GenerationBatchRecord>(generationBatchStorageKey);
    const record = this.toGenerationBatchRecord(batch);
    this.upsert(batches, record, (current) => current.id === batch.id, generationBatchStorageKey);
    return this.toGenerationBatch(record);
  }

  public async listGenerationBatches(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetGenerationBatch>> {
    return Object.freeze(this.readCollection<GenerationBatchRecord>(generationBatchStorageKey)
      .filter((record) => record.datasetId === datasetId && record.versionId === versionId)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
      .map((record) => this.toGenerationBatch(record)));
  }

  public async saveExportArtifact(artifact: DatasetExportArtifact): Promise<DatasetExportArtifact> {
    const exports = this.readCollection<ExportRecord>(exportStorageKey);
    const record = this.toExportRecord(artifact);
    this.upsert(exports, record, (current) => current.id === artifact.id, exportStorageKey);
    return this.toExport(record);
  }

  public async listExportArtifacts(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>> {
    return Object.freeze(this.readCollection<ExportRecord>(exportStorageKey)
      .filter((record) => record.datasetId === datasetId && record.versionId === versionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => this.toExport(record)));
  }

  public async saveWorkflowState(workflow: DatasetWorkflowState): Promise<DatasetWorkflowState> {
    const workflows = this.readCollection<WorkflowRecord>(workflowStorageKey);
    const record: WorkflowRecord = {
      datasetId: workflow.datasetId,
      versionId: workflow.versionId,
      currentStage: workflow.currentStage,
      completedStages: workflow.completedStages,
      stageStates: workflow.stageStates,
      progressPercent: workflow.progressPercent,
      lastVisitedStage: workflow.lastVisitedStage,
      updatedAt: workflow.updatedAt.toISOString(),
    };
    this.upsert(workflows, record, (current) => current.datasetId === workflow.datasetId && current.versionId === workflow.versionId, workflowStorageKey);
    return this.toWorkflow(record);
  }

  public async loadWorkflowState(datasetId: string, versionId: string): Promise<DatasetWorkflowState | undefined> {
    const record = this.readCollection<WorkflowRecord>(workflowStorageKey).find((entry) => entry.datasetId === datasetId && entry.versionId === versionId);
    return record ? this.toWorkflow(record) : undefined;
  }

  private readCollection<T>(key: string): T[] {
    const raw = this.storage?.getItem(key);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private writeCollection<T>(key: string, values: ReadonlyArray<T>): void {
    this.storage?.setItem(key, JSON.stringify(values, null, 2));
  }

  private upsert<T>(values: T[], record: T, matcher: (value: T) => boolean, key: string): void {
    const nextValues = values.filter((value) => !matcher(value));
    nextValues.push(record);
    this.writeCollection(key, nextValues);
  }

  private toVersionRecord(version: DatasetVersion): VersionRecord {
    return {
      id: version.id,
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      status: version.status,
      kind: version.kind,
      parentVersionId: version.parentVersionId,
      sourceVersionId: version.sourceVersionId,
      comparisonLabel: version.comparisonLabel,
      createdBy: version.createdBy,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      releasedAt: version.releasedAt?.toISOString(),
      releaseNotes: version.releaseNotes,
      schema: version.schema,
      validationResult: version.validationResult ? this.toValidationRecord(version.validationResult) : undefined,
      statistics: version.statistics,
    };
  }

  private toVersion(record: VersionRecord): DatasetVersion {
    return new TuningDatasetVersion({
      id: record.id,
      datasetId: record.datasetId,
      versionNumber: record.versionNumber,
      status: record.status,
      kind: record.kind,
      parentVersionId: record.parentVersionId,
      sourceVersionId: record.sourceVersionId,
      comparisonLabel: record.comparisonLabel,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      releasedAt: record.releasedAt ? new Date(record.releasedAt) : undefined,
      releaseNotes: record.releaseNotes,
      schema: record.schema,
      validationResult: record.validationResult ? this.toValidationResult(record.validationResult) : undefined,
      statistics: record.statistics,
    });
  }

  private toExampleRecord(example: DatasetExample): ExampleRecord {
    return {
      id: example.id,
      datasetId: example.datasetId,
      versionId: example.versionId,
      taskType: example.taskType,
      question: example instanceof QuestionAnsweringExample ? example.question : undefined,
      answer: example instanceof QuestionAnsweringExample ? example.answer : undefined,
      context: example instanceof QuestionAnsweringExample ? example.context : undefined,
      sourceDocumentId: example instanceof QuestionAnsweringExample ? example.sourceDocumentId : undefined,
      sourceOffsets: example instanceof QuestionAnsweringExample ? example.sourceOffsets : undefined,
      sourceMetadata: example instanceof QuestionAnsweringExample ? example.sourceMetadata : undefined,
      messages: example instanceof ChatCompletionExample ? example.messages : undefined,
      split: example.split,
      status: example.status,
      tags: example.tags,
      createdBy: example.createdBy,
      createdAt: example.createdAt.toISOString(),
      updatedAt: example.updatedAt.toISOString(),
      lineage: {
        sourceDocumentId: example.lineage.sourceDocumentId,
        generatedFromExampleId: example.lineage.generatedFromExampleId,
        generationMethod: example.lineage.generationMethod,
        promptTemplateVersion: example.lineage.promptTemplateVersion,
        capturedAt: example.lineage.capturedAt.toISOString(),
        metadata: example.lineage.metadata,
        generator: example.lineage.generator ? {
          ...example.lineage.generator,
          startedAt: example.lineage.generator.startedAt.toISOString(),
          executedAt: example.lineage.generator.executedAt.toISOString(),
        } : undefined,
      },
      validationIssues: example.validationIssues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        exampleId: issue.exampleId,
        field: issue.field,
        stage: issue.stage,
      })),
      annotations: example.annotations.map((annotation) => ({
        id: annotation.id,
        author: annotation.author,
        note: annotation.note,
        createdAt: annotation.createdAt.toISOString(),
      })),
    };
  }

  private toExample(record: ExampleRecord): DatasetExample {
    const lineage = new ExampleLineage({
      sourceDocumentId: record.lineage.sourceDocumentId,
      generatedFromExampleId: record.lineage.generatedFromExampleId,
      generationMethod: record.lineage.generationMethod,
      promptTemplateVersion: record.lineage.promptTemplateVersion,
      capturedAt: new Date(record.lineage.capturedAt),
      metadata: record.lineage.metadata,
      generator: record.lineage.generator ? {
        ...record.lineage.generator,
        startedAt: new Date(record.lineage.generator.startedAt),
        executedAt: new Date(record.lineage.generator.executedAt),
        diagnostics: Object.freeze(record.lineage.generator.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
        fallback: record.lineage.generator.fallback ? Object.freeze({ ...record.lineage.generator.fallback }) : undefined,
      } : undefined,
    });
    const annotations = record.annotations.map((annotation) => new ExampleAnnotation({
      id: annotation.id,
      author: annotation.author,
      note: annotation.note,
      createdAt: new Date(annotation.createdAt),
    }));
    const validationIssues = record.validationIssues.map((issue) => new ValidationIssue(issue));

    if (record.taskType === "question_answering") {
      return new QuestionAnsweringExample({
        id: record.id,
        datasetId: record.datasetId,
        versionId: record.versionId,
        question: record.question ?? "",
        answer: record.answer ?? "",
        context: record.context ?? "",
        sourceDocumentId: record.sourceDocumentId,
        sourceOffsets: record.sourceOffsets,
        sourceMetadata: record.sourceMetadata,
        split: record.split,
        status: record.status,
        tags: record.tags,
        createdBy: record.createdBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        lineage,
        validationIssues,
        annotations,
      });
    }

    return new ChatCompletionExample({
      id: record.id,
      datasetId: record.datasetId,
      versionId: record.versionId,
      messages: record.messages ?? [],
      split: record.split,
      status: record.status,
      tags: record.tags,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      lineage,
      validationIssues,
      annotations,
    });
  }

  private toSourceRecord(document: DatasetSourceDocument): SourceDocumentRecord {
    return {
      id: document.id,
      datasetId: document.datasetId,
      versionId: document.versionId,
      name: document.name,
      content: document.content,
      normalizedContent: document.normalizedContent,
      checksum: document.checksum,
      sourceType: document.sourceType,
      mediaType: document.mediaType,
      createdBy: document.createdBy,
      createdAt: document.createdAt.toISOString(),
      segments: document.segments.map((segment) => ({
        id: segment.id,
        sourceDocumentId: segment.sourceDocumentId,
        index: segment.index,
        kind: segment.kind,
        text: segment.text,
        checksum: segment.checksum,
      })),
      metadata: document.metadata,
    };
  }

  private toSourceDocument(record: SourceDocumentRecord): DatasetSourceDocument {
    return new SourceDocumentReference({
      id: record.id,
      datasetId: record.datasetId,
      versionId: record.versionId,
      name: record.name,
      content: record.content,
      normalizedContent: record.normalizedContent,
      checksum: record.checksum,
      sourceType: record.sourceType,
      mediaType: record.mediaType,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      segments: record.segments,
      metadata: record.metadata,
    });
  }

  private toValidationRecord(result: DatasetValidationResult): SerializedValidationResult {
    return {
      datasetId: result.datasetId,
      versionId: result.versionId,
      validatedAt: result.validatedAt.toISOString(),
      issues: result.issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        exampleId: issue.exampleId,
        field: issue.field,
        stage: issue.stage,
      })),
      isValid: result.isValid,
      blockingIssueCount: result.blockingIssueCount,
      warningCount: result.warningCount,
      readiness: {
        ...result.readiness,
        blockingReasons: result.readiness.blockingReasons,
      },
    };
  }

  private toValidationResult(record: SerializedValidationResult): DatasetValidationResult {
    return Object.freeze({
      datasetId: record.datasetId,
      versionId: record.versionId,
      validatedAt: new Date(record.validatedAt),
      issues: Object.freeze(record.issues.map((issue) => new ValidationIssue(issue))),
      isValid: record.isValid,
      blockingIssueCount: record.blockingIssueCount,
      warningCount: record.warningCount,
      readiness: Object.freeze({
        ...record.readiness,
        blockingReasons: Object.freeze([...record.readiness.blockingReasons]),
      }),
    });
  }

  private toGenerationBatchRecord(batch: DatasetGenerationBatch): GenerationBatchRecord {
    return {
      id: batch.id,
      datasetId: batch.datasetId,
      versionId: batch.versionId,
      taskType: batch.taskType,
      generatedAt: batch.generatedAt.toISOString(),
      generatedCount: batch.generatedCount,
      skippedCount: batch.skippedCount,
      status: batch.status,
      provenance: {
        ...batch.provenance,
        startedAt: batch.provenance.startedAt.toISOString(),
        executedAt: batch.provenance.executedAt.toISOString(),
      },
      exampleIds: batch.exampleIds,
    };
  }

  private toGenerationBatch(record: GenerationBatchRecord): DatasetGenerationBatch {
    return Object.freeze({
      id: record.id,
      datasetId: record.datasetId,
      versionId: record.versionId,
      taskType: record.taskType,
      generatedAt: new Date(record.generatedAt),
      generatedCount: record.generatedCount,
      skippedCount: record.skippedCount,
      status: record.status,
      provenance: Object.freeze({
        ...record.provenance,
        startedAt: new Date(record.provenance.startedAt),
        executedAt: new Date(record.provenance.executedAt),
        parameters: Object.freeze({ ...record.provenance.parameters }),
        diagnostics: Object.freeze(record.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
        fallback: record.provenance.fallback ? Object.freeze({ ...record.provenance.fallback }) : undefined,
      }),
      exampleIds: Object.freeze([...record.exampleIds]),
    });
  }

  private toExportRecord(artifact: DatasetExportArtifact): ExportRecord {
    return {
      id: artifact.id,
      datasetId: artifact.datasetId,
      versionId: artifact.versionId,
      format: artifact.format,
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      content: artifact.content,
      byteLength: artifact.byteLength,
      checksum: artifact.checksum,
      createdAt: artifact.createdAt.toISOString(),
    };
  }

  private toExport(record: ExportRecord): DatasetExportArtifact {
    return new DatasetExportRecordEntity({
      id: record.id,
      datasetId: record.datasetId,
      versionId: record.versionId,
      format: record.format,
      fileName: record.fileName,
      contentType: record.contentType,
      content: record.content,
      byteLength: record.byteLength,
      checksum: record.checksum,
      createdAt: new Date(record.createdAt),
    });
  }

  private toWorkflow(record: WorkflowRecord): DatasetWorkflowState {
    return new DatasetWorkflow({
      datasetId: record.datasetId,
      versionId: record.versionId,
      currentStage: record.currentStage,
      completedStages: record.completedStages,
      stageStates: record.stageStates,
      progressPercent: record.progressPercent,
      lastVisitedStage: record.lastVisitedStage,
      updatedAt: new Date(record.updatedAt),
    });
  }
}
