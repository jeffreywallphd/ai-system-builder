import type {
  Dataset,
  DatasetExample,
  DatasetExportArtifact,
  DatasetLineage,
  DatasetSchema,
  DatasetStatistics,
  DatasetTaskType,
  DatasetValidationIssue,
  DatasetValidationResult,
  DatasetVersion,
  ExampleStatus,
  SplitType,
  DatasetStatus,
  ExportFormat,
} from "./interfaces/ITuningDatasetStudio";

function requireText(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(`${field} cannot be empty.`);
  }
  return normalized;
}

function freezeStrings(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value) : undefined;
}

function createIssueId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SourceDocumentReference {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly name: string;
  public readonly content: string;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    name: string;
    content: string;
    createdBy: string;
    createdAt?: Date;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = requireText(params.id, "SourceDocumentReference.id");
    this.datasetId = requireText(params.datasetId, "SourceDocumentReference.datasetId");
    this.versionId = requireText(params.versionId, "SourceDocumentReference.versionId");
    this.name = requireText(params.name, "SourceDocumentReference.name");
    this.content = requireText(params.content, "SourceDocumentReference.content");
    this.createdBy = requireText(params.createdBy, "SourceDocumentReference.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.metadata = params.metadata ? Object.freeze({ ...params.metadata }) : undefined;
  }
}

export class ExampleLineage implements DatasetLineage {
  public readonly sourceDocumentId?: string;
  public readonly generatedFromExampleId?: string;
  public readonly generationMethod: string;
  public readonly promptTemplateVersion?: string;
  public readonly capturedAt: Date;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    sourceDocumentId?: string;
    generatedFromExampleId?: string;
    generationMethod: string;
    promptTemplateVersion?: string;
    capturedAt?: Date;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.sourceDocumentId = params.sourceDocumentId?.trim() || undefined;
    this.generatedFromExampleId = params.generatedFromExampleId?.trim() || undefined;
    this.generationMethod = requireText(params.generationMethod, "ExampleLineage.generationMethod");
    this.promptTemplateVersion = params.promptTemplateVersion?.trim() || undefined;
    this.capturedAt = cloneDate(params.capturedAt) ?? new Date();
    this.metadata = params.metadata ? Object.freeze({ ...params.metadata }) : undefined;
  }

  public static generatedFromSource(sourceDocumentId: string, metadata?: Readonly<Record<string, unknown>>): ExampleLineage {
    return new ExampleLineage({
      sourceDocumentId,
      generationMethod: "source-to-qa-generation",
      promptTemplateVersion: "qa-v1",
      metadata,
    });
  }
}

export class ExampleAnnotation {
  public readonly id: string;
  public readonly author: string;
  public readonly note: string;
  public readonly createdAt: Date;

  constructor(params: { id?: string; author: string; note: string; createdAt?: Date }) {
    this.id = params.id?.trim() || createIssueId("annotation");
    this.author = requireText(params.author, "ExampleAnnotation.author");
    this.note = requireText(params.note, "ExampleAnnotation.note");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
  }
}

export class ValidationIssue implements DatasetValidationIssue {
  public readonly id: string;
  public readonly severity: DatasetValidationIssue["severity"];
  public readonly code: string;
  public readonly message: string;
  public readonly exampleId?: string;
  public readonly field?: string;

  constructor(params: {
    id?: string;
    severity: DatasetValidationIssue["severity"];
    code: string;
    message: string;
    exampleId?: string;
    field?: string;
  }) {
    this.id = params.id?.trim() || createIssueId("validation");
    this.severity = params.severity;
    this.code = requireText(params.code, "ValidationIssue.code");
    this.message = requireText(params.message, "ValidationIssue.message");
    this.exampleId = params.exampleId?.trim() || undefined;
    this.field = params.field?.trim() || undefined;
  }
}

export abstract class TuningDatasetExample implements DatasetExample {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly taskType: DatasetTaskType;
  public readonly split: SplitType;
  public readonly status: ExampleStatus;
  public readonly tags: ReadonlyArray<string>;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly lineage: DatasetLineage;
  public readonly validationIssues: ReadonlyArray<DatasetValidationIssue>;
  public readonly annotations: ReadonlyArray<ExampleAnnotation>;

  protected constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    taskType: DatasetTaskType;
    split?: SplitType;
    status?: ExampleStatus;
    tags?: ReadonlyArray<string>;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    lineage: DatasetLineage;
    validationIssues?: ReadonlyArray<DatasetValidationIssue>;
    annotations?: ReadonlyArray<ExampleAnnotation>;
  }) {
    this.id = requireText(params.id, "TuningDatasetExample.id");
    this.datasetId = requireText(params.datasetId, "TuningDatasetExample.datasetId");
    this.versionId = requireText(params.versionId, "TuningDatasetExample.versionId");
    this.taskType = params.taskType;
    this.split = params.split ?? "train";
    this.status = params.status ?? "draft";
    this.tags = freezeStrings(params.tags);
    this.createdBy = requireText(params.createdBy, "TuningDatasetExample.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.updatedAt = cloneDate(params.updatedAt) ?? this.createdAt;
    this.lineage = params.lineage;
    this.validationIssues = Object.freeze([...(params.validationIssues ?? [])].map((issue) => new ValidationIssue(issue)));
    this.annotations = Object.freeze([...(params.annotations ?? [])].map((annotation) => new ExampleAnnotation(annotation)));
  }

  protected assertStatusTransition(nextStatus: ExampleStatus): void {
    const allowedTransitions = {
      draft: ["accepted", "rejected", "needs_review", "draft"],
      accepted: ["needs_review", "rejected", "accepted"],
      rejected: ["needs_review", "accepted", "rejected"],
      needs_review: ["accepted", "rejected", "needs_review"],
    } as const satisfies Readonly<Record<ExampleStatus, ReadonlyArray<ExampleStatus>>>;

    if (!allowedTransitions[this.status].includes(nextStatus)) {
      throw new Error(`Illegal example status transition: ${this.status} -> ${nextStatus}.`);
    }
  }
}

export class QuestionAnsweringExample extends TuningDatasetExample {
  public readonly question: string;
  public readonly answer: string;
  public readonly context: string;
  public readonly sourceDocumentId?: string;
  public readonly sourceOffsets?: Readonly<{ start: number; end: number }>;
  public readonly sourceMetadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    question: string;
    answer: string;
    context: string;
    sourceDocumentId?: string;
    sourceOffsets?: Readonly<{ start: number; end: number }>;
    sourceMetadata?: Readonly<Record<string, unknown>>;
    split?: SplitType;
    status?: ExampleStatus;
    tags?: ReadonlyArray<string>;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    lineage?: DatasetLineage;
    validationIssues?: ReadonlyArray<DatasetValidationIssue>;
    annotations?: ReadonlyArray<ExampleAnnotation>;
  }) {
    const lineage = params.lineage ?? ExampleLineage.generatedFromSource(params.sourceDocumentId ?? "manual");
    super({
      id: params.id,
      datasetId: params.datasetId,
      versionId: params.versionId,
      taskType: "question_answering",
      split: params.split,
      status: params.status,
      tags: params.tags,
      createdBy: params.createdBy,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      lineage,
      validationIssues: params.validationIssues,
      annotations: params.annotations,
    });

    this.question = requireText(params.question, "QuestionAnsweringExample.question");
    this.answer = requireText(params.answer, "QuestionAnsweringExample.answer");
    this.context = requireText(params.context, "QuestionAnsweringExample.context");
    this.sourceDocumentId = params.sourceDocumentId?.trim() || undefined;
    this.sourceOffsets = params.sourceOffsets ? Object.freeze({ ...params.sourceOffsets }) : undefined;
    this.sourceMetadata = params.sourceMetadata ? Object.freeze({ ...params.sourceMetadata }) : undefined;
  }

  public withContent(params: {
    question?: string;
    answer?: string;
    context?: string;
    split?: SplitType;
    status?: ExampleStatus;
    tags?: ReadonlyArray<string>;
    validationIssues?: ReadonlyArray<DatasetValidationIssue>;
    annotations?: ReadonlyArray<ExampleAnnotation>;
  }): QuestionAnsweringExample {
    const nextStatus = params.status ?? this.status;
    this.assertStatusTransition(nextStatus);

    return new QuestionAnsweringExample({
      id: this.id,
      datasetId: this.datasetId,
      versionId: this.versionId,
      question: params.question ?? this.question,
      answer: params.answer ?? this.answer,
      context: params.context ?? this.context,
      sourceDocumentId: this.sourceDocumentId,
      sourceOffsets: this.sourceOffsets,
      sourceMetadata: this.sourceMetadata,
      split: params.split ?? this.split,
      status: nextStatus,
      tags: params.tags ?? this.tags,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      lineage: this.lineage,
      validationIssues: params.validationIssues ?? this.validationIssues,
      annotations: params.annotations ?? this.annotations,
    });
  }

  public withStatus(status: ExampleStatus, annotation?: ExampleAnnotation): QuestionAnsweringExample {
    return this.withContent({
      status,
      annotations: annotation ? [...this.annotations, annotation] : this.annotations,
    });
  }
}

export class TuningDatasetVersion implements DatasetVersion {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionNumber: number;
  public readonly status: DatasetStatus;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly releasedAt?: Date;
  public readonly releaseNotes?: string;
  public readonly validationResult?: DatasetValidationResult;
  public readonly statistics?: DatasetStatistics;
  public readonly schema: DatasetSchema;
  public readonly isMutable: boolean;

  constructor(params: {
    id: string;
    datasetId: string;
    versionNumber: number;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    status?: DatasetStatus;
    releasedAt?: Date;
    releaseNotes?: string;
    validationResult?: DatasetValidationResult;
    statistics?: DatasetStatistics;
    schema: DatasetSchema;
  }) {
    this.id = requireText(params.id, "TuningDatasetVersion.id");
    this.datasetId = requireText(params.datasetId, "TuningDatasetVersion.datasetId");
    if (params.versionNumber < 1) {
      throw new Error("TuningDatasetVersion.versionNumber must be greater than zero.");
    }
    this.versionNumber = params.versionNumber;
    this.createdBy = requireText(params.createdBy, "TuningDatasetVersion.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.updatedAt = cloneDate(params.updatedAt) ?? this.createdAt;
    this.status = params.status ?? "draft";
    this.releasedAt = cloneDate(params.releasedAt);
    this.releaseNotes = params.releaseNotes?.trim() || undefined;
    this.validationResult = params.validationResult
      ? {
          ...params.validationResult,
          validatedAt: new Date(params.validationResult.validatedAt),
          issues: Object.freeze(params.validationResult.issues.map((issue) => new ValidationIssue(issue))),
        }
      : undefined;
    this.statistics = params.statistics
      ? {
          ...params.statistics,
          splitCounts: Object.freeze({ ...params.statistics.splitCounts }),
        }
      : undefined;
    this.schema = Object.freeze({ ...params.schema, requiredFields: Object.freeze([...params.schema.requiredFields]) });
    this.isMutable = this.status !== "released" && this.status !== "archived";

    if (this.status === "released" && !this.releasedAt) {
      throw new Error("Released dataset versions must have a releasedAt timestamp.");
    }
  }

  public assertMutable(): void {
    if (!this.isMutable) {
      throw new Error(`Dataset version '${this.id}' is immutable because it is ${this.status}.`);
    }
  }

  public withValidation(validationResult: DatasetValidationResult, statistics?: DatasetStatistics): TuningDatasetVersion {
    this.assertMutable();
    return new TuningDatasetVersion({
      id: this.id,
      datasetId: this.datasetId,
      versionNumber: this.versionNumber,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      status: validationResult.isValid ? "validated" : "in_review",
      validationResult,
      statistics: statistics ?? this.statistics,
      schema: this.schema,
    });
  }

  public release(releaseNotes: string | undefined, validationResult: DatasetValidationResult, statistics?: DatasetStatistics): TuningDatasetVersion {
    this.assertMutable();
    if (!validationResult.isValid || validationResult.blockingIssueCount > 0) {
      throw new Error("Dataset version release requires a validation pass with no blocking errors.");
    }

    return new TuningDatasetVersion({
      id: this.id,
      datasetId: this.datasetId,
      versionNumber: this.versionNumber,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      status: "released",
      releasedAt: new Date(),
      releaseNotes,
      validationResult,
      statistics: statistics ?? this.statistics,
      schema: this.schema,
    });
  }
}

export class TuningDataset implements Dataset {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly taskType: DatasetTaskType;
  public readonly status: DatasetStatus;
  public readonly tags: ReadonlyArray<string>;
  public readonly latestVersionId?: string;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly archivedAt?: Date;

  constructor(params: {
    id: string;
    name: string;
    description?: string;
    taskType: DatasetTaskType;
    status?: DatasetStatus;
    tags?: ReadonlyArray<string>;
    latestVersionId?: string;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    archivedAt?: Date;
  }) {
    this.id = requireText(params.id, "TuningDataset.id");
    this.name = requireText(params.name, "TuningDataset.name");
    this.description = params.description?.trim() || undefined;
    this.taskType = params.taskType;
    this.status = params.status ?? "draft";
    this.tags = freezeStrings(params.tags);
    this.latestVersionId = params.latestVersionId?.trim() || undefined;
    this.createdBy = requireText(params.createdBy, "TuningDataset.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.updatedAt = cloneDate(params.updatedAt) ?? this.createdAt;
    this.archivedAt = cloneDate(params.archivedAt);
  }

  public withLatestVersion(version: TuningDatasetVersion): TuningDataset {
    return new TuningDataset({
      id: this.id,
      name: this.name,
      description: this.description,
      taskType: this.taskType,
      status: version.status,
      tags: this.tags,
      latestVersionId: version.id,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      archivedAt: this.archivedAt,
    });
  }

  public withTaskType(taskType: DatasetTaskType, hasExamples: boolean): TuningDataset {
    if (hasExamples && taskType !== this.taskType) {
      throw new Error("Dataset task type cannot change once examples exist.");
    }

    return new TuningDataset({
      id: this.id,
      name: this.name,
      description: this.description,
      taskType,
      status: this.status,
      tags: this.tags,
      latestVersionId: this.latestVersionId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      archivedAt: this.archivedAt,
    });
  }

  public archive(): TuningDataset {
    return new TuningDataset({
      id: this.id,
      name: this.name,
      description: this.description,
      taskType: this.taskType,
      status: "archived",
      tags: this.tags,
      latestVersionId: this.latestVersionId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      archivedAt: new Date(),
    });
  }
}

export class DatasetReleaseManifest {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly createdAt: Date;
  public readonly checksum: string;
  public readonly metadata: Readonly<Record<string, unknown>>;

  constructor(params: {
    id?: string;
    datasetId: string;
    versionId: string;
    createdAt?: Date;
    checksum: string;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = params.id?.trim() || createIssueId("manifest");
    this.datasetId = requireText(params.datasetId, "DatasetReleaseManifest.datasetId");
    this.versionId = requireText(params.versionId, "DatasetReleaseManifest.versionId");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.checksum = requireText(params.checksum, "DatasetReleaseManifest.checksum");
    this.metadata = Object.freeze({ ...(params.metadata ?? {}) });
  }
}

export class DatasetExportRecord implements DatasetExportArtifact {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly format: ExportFormat;
  public readonly fileName: string;
  public readonly contentType: string;
  public readonly content: string;
  public readonly byteLength: number;
  public readonly checksum: string;
  public readonly createdAt: Date;

  constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    format: ExportFormat;
    fileName: string;
    contentType: string;
    content: string;
    byteLength?: number;
    checksum: string;
    createdAt?: Date;
  }) {
    this.id = requireText(params.id, "DatasetExportRecord.id");
    this.datasetId = requireText(params.datasetId, "DatasetExportRecord.datasetId");
    this.versionId = requireText(params.versionId, "DatasetExportRecord.versionId");
    this.format = params.format;
    this.fileName = requireText(params.fileName, "DatasetExportRecord.fileName");
    this.contentType = requireText(params.contentType, "DatasetExportRecord.contentType");
    this.content = params.content;
    this.byteLength = params.byteLength ?? new TextEncoder().encode(params.content).length;
    this.checksum = requireText(params.checksum, "DatasetExportRecord.checksum");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
  }
}
