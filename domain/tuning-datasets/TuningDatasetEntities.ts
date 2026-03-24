import type {
  ChatCompletionMessage,
  Dataset,
  DatasetExample,
  DatasetExportArtifact,
  DatasetGenerationProvenance,
  DatasetLineage,
  DatasetSchema,
  DatasetSourceDocument,
  DatasetSourceSegment,
  DatasetStatistics,
  DatasetTaskType,
  DatasetValidationIssue,
  DatasetValidationResult,
  DatasetVersion,
  DatasetWorkflowStage,
  DatasetWorkflowStageState,
  DatasetWorkflowState,
  ExampleStatus,
  ExportFormat,
  SplitType,
  DatasetStatus,
  DatasetVersionKind,
  WorkflowStageStatus,
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

function defaultChecksum(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `chk_${Math.abs(hash)}`;
}

export class SourceSegmentReference implements DatasetSourceSegment {
  public readonly id: string;
  public readonly sourceDocumentId: string;
  public readonly index: number;
  public readonly kind: DatasetSourceSegment["kind"];
  public readonly text: string;
  public readonly checksum: string;

  constructor(params: DatasetSourceSegment) {
    this.id = requireText(params.id, "SourceSegmentReference.id");
    this.sourceDocumentId = requireText(params.sourceDocumentId, "SourceSegmentReference.sourceDocumentId");
    this.index = params.index;
    this.kind = params.kind;
    this.text = requireText(params.text, "SourceSegmentReference.text");
    this.checksum = requireText(params.checksum, "SourceSegmentReference.checksum");
  }
}

export class SourceDocumentReference implements DatasetSourceDocument {
  public readonly id: string;
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly name: string;
  public readonly content: string;
  public readonly normalizedContent: string;
  public readonly checksum: string;
  public readonly sourceType: DatasetSourceDocument["sourceType"];
  public readonly mediaType: string;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public readonly segments: ReadonlyArray<SourceSegmentReference>;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    name: string;
    content: string;
    normalizedContent?: string;
    checksum?: string;
    sourceType?: DatasetSourceDocument["sourceType"];
    mediaType?: string;
    createdBy: string;
    createdAt?: Date;
    segments?: ReadonlyArray<DatasetSourceSegment>;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = requireText(params.id, "SourceDocumentReference.id");
    this.datasetId = requireText(params.datasetId, "SourceDocumentReference.datasetId");
    this.versionId = requireText(params.versionId, "SourceDocumentReference.versionId");
    this.name = requireText(params.name, "SourceDocumentReference.name");
    this.content = requireText(params.content, "SourceDocumentReference.content");
    this.normalizedContent = requireText(params.normalizedContent ?? params.content, "SourceDocumentReference.normalizedContent");
    this.checksum = requireText(params.checksum ?? defaultChecksum(this.normalizedContent), "SourceDocumentReference.checksum");
    this.sourceType = params.sourceType ?? "manual_text";
    this.mediaType = params.mediaType?.trim() || "text/plain";
    this.createdBy = requireText(params.createdBy, "SourceDocumentReference.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.segments = Object.freeze([...(params.segments ?? [])].map((segment) => new SourceSegmentReference(segment)));
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
  public readonly generator?: DatasetGenerationProvenance;

  constructor(params: {
    sourceDocumentId?: string;
    generatedFromExampleId?: string;
    generationMethod: string;
    promptTemplateVersion?: string;
    capturedAt?: Date;
    metadata?: Readonly<Record<string, unknown>>;
    generator?: DatasetGenerationProvenance;
  }) {
    this.sourceDocumentId = params.sourceDocumentId?.trim() || undefined;
    this.generatedFromExampleId = params.generatedFromExampleId?.trim() || undefined;
    this.generationMethod = requireText(params.generationMethod, "ExampleLineage.generationMethod");
    this.promptTemplateVersion = params.promptTemplateVersion?.trim() || undefined;
    this.capturedAt = cloneDate(params.capturedAt) ?? new Date();
    this.metadata = params.metadata ? Object.freeze({ ...params.metadata }) : undefined;
    this.generator = params.generator
      ? Object.freeze({
          ...params.generator,
          startedAt: new Date(params.generator.startedAt),
          executedAt: new Date(params.generator.executedAt),
          parameters: Object.freeze({ ...params.generator.parameters }),
          diagnostics: Object.freeze(params.generator.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
          fallback: params.generator.fallback ? Object.freeze({ ...params.generator.fallback }) : undefined,
        })
      : undefined;
  }

  public static generatedFromSource(
    sourceDocumentId: string,
    metadata?: Readonly<Record<string, unknown>>,
    generator?: DatasetGenerationProvenance,
  ): ExampleLineage {
    return new ExampleLineage({
      sourceDocumentId,
      generationMethod: "source-derived-generation",
      promptTemplateVersion: "dataset-v2",
      metadata,
      generator,
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
  public readonly stage?: DatasetWorkflowStage;

  constructor(params: {
    id?: string;
    severity: DatasetValidationIssue["severity"];
    code: string;
    message: string;
    exampleId?: string;
    field?: string;
    stage?: DatasetValidationIssue["stage"];
  }) {
    this.id = params.id?.trim() || createIssueId("validation");
    this.severity = params.severity;
    this.code = requireText(params.code, "ValidationIssue.code");
    this.message = requireText(params.message, "ValidationIssue.message");
    this.exampleId = params.exampleId?.trim() || undefined;
    this.field = params.field?.trim() || undefined;
    this.stage = params.stage;
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
    this.lineage = new ExampleLineage(params.lineage);
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

    if (!(allowedTransitions[this.status] as ReadonlyArray<ExampleStatus>).includes(nextStatus)) {
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

export class ChatCompletionExample extends TuningDatasetExample {
  public readonly messages: ReadonlyArray<ChatCompletionMessage>;

  constructor(params: {
    id: string;
    datasetId: string;
    versionId: string;
    messages: ReadonlyArray<ChatCompletionMessage>;
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
    super({
      id: params.id,
      datasetId: params.datasetId,
      versionId: params.versionId,
      taskType: "chat_completion",
      split: params.split,
      status: params.status,
      tags: params.tags,
      createdBy: params.createdBy,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      lineage: params.lineage ?? new ExampleLineage({ generationMethod: "manual-authoring" }),
      validationIssues: params.validationIssues,
      annotations: params.annotations,
    });

    if (params.messages.length < 2) {
      throw new Error("ChatCompletionExample.messages must include at least a user message and assistant message.");
    }
    this.messages = Object.freeze(params.messages.map((message) => ({ role: message.role, content: requireText(message.content, `ChatCompletionExample.messages.${message.role}`) })));
    if (!this.messages.some((message) => message.role === "assistant")) {
      throw new Error("ChatCompletionExample.messages must include an assistant response.");
    }
  }

  public withContent(params: {
    messages?: ReadonlyArray<ChatCompletionMessage>;
    split?: SplitType;
    status?: ExampleStatus;
    tags?: ReadonlyArray<string>;
    validationIssues?: ReadonlyArray<DatasetValidationIssue>;
    annotations?: ReadonlyArray<ExampleAnnotation>;
  }): ChatCompletionExample {
    const nextStatus = params.status ?? this.status;
    this.assertStatusTransition(nextStatus);

    return new ChatCompletionExample({
      id: this.id,
      datasetId: this.datasetId,
      versionId: this.versionId,
      messages: params.messages ?? this.messages,
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

  public withStatus(status: ExampleStatus, annotation?: ExampleAnnotation): ChatCompletionExample {
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
  public readonly kind: DatasetVersionKind;
  public readonly parentVersionId?: string;
  public readonly sourceVersionId?: string;
  public readonly comparisonLabel?: string;
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
    kind?: DatasetVersionKind;
    parentVersionId?: string;
    sourceVersionId?: string;
    comparisonLabel?: string;
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
    this.status = params.status ?? "draft";
    this.kind = params.kind ?? (this.status === "released" ? "released_snapshot" : "initial_draft");
    this.parentVersionId = params.parentVersionId?.trim() || undefined;
    this.sourceVersionId = params.sourceVersionId?.trim() || undefined;
    this.comparisonLabel = params.comparisonLabel?.trim() || undefined;
    this.createdBy = requireText(params.createdBy, "TuningDatasetVersion.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.updatedAt = cloneDate(params.updatedAt) ?? this.createdAt;
    this.releasedAt = cloneDate(params.releasedAt);
    this.releaseNotes = params.releaseNotes?.trim() || undefined;
    this.validationResult = params.validationResult
      ? {
          ...params.validationResult,
          validatedAt: new Date(params.validationResult.validatedAt),
          readiness: {
            ...params.validationResult.readiness,
            blockingReasons: Object.freeze([...params.validationResult.readiness.blockingReasons]),
          },
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
      kind: this.kind,
      parentVersionId: this.parentVersionId,
      sourceVersionId: this.sourceVersionId,
      comparisonLabel: this.comparisonLabel,
      validationResult,
      statistics: statistics ?? this.statistics,
      schema: this.schema,
    });
  }

  public release(params: {
    readonly releaseNotes?: string;
    readonly validationResult: DatasetValidationResult;
    readonly statistics?: DatasetStatistics;
  }): TuningDatasetVersion {
    this.assertMutable();
    if (this.status === "released") {
      throw new Error("Dataset version is already released.");
    }
    if (!params.validationResult.isValid || params.validationResult.blockingIssueCount > 0) {
      throw new Error("Dataset version release requires a validation pass with no blocking errors.");
    }
    if (!params.validationResult.readiness.isReady) {
      throw new Error(`Dataset version release is blocked: ${params.validationResult.readiness.blockingReasons.join(", ")}.`);
    }

    return new TuningDatasetVersion({
      id: this.id,
      datasetId: this.datasetId,
      versionNumber: this.versionNumber,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      status: "released",
      kind: "released_snapshot",
      parentVersionId: this.parentVersionId,
      sourceVersionId: this.sourceVersionId,
      comparisonLabel: this.comparisonLabel,
      releasedAt: new Date(),
      releaseNotes: params.releaseNotes,
      validationResult: params.validationResult,
      statistics: params.statistics ?? this.statistics,
      schema: this.schema,
    });
  }

  public createDraftSuccessor(params: {
    readonly id: string;
    readonly versionNumber: number;
    readonly createdBy: string;
    readonly comparisonLabel?: string;
  }): TuningDatasetVersion {
    if (this.status !== "released") {
      throw new Error("Only released versions can be branched into a successor draft.");
    }

    return new TuningDatasetVersion({
      id: params.id,
      datasetId: this.datasetId,
      versionNumber: params.versionNumber,
      createdBy: params.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
      kind: "successor_draft",
      parentVersionId: this.id,
      sourceVersionId: this.id,
      comparisonLabel: params.comparisonLabel ?? `Draft successor to v${this.versionNumber}`,
      schema: this.schema,
    });
  }
}

export class DatasetWorkflow implements DatasetWorkflowState {
  public readonly datasetId: string;
  public readonly versionId: string;
  public readonly currentStage: DatasetWorkflowStage;
  public readonly completedStages: ReadonlyArray<DatasetWorkflowStage>;
  public readonly stageStates: ReadonlyArray<DatasetWorkflowStageState>;
  public readonly progressPercent: number;
  public readonly lastVisitedStage: DatasetWorkflowStage;
  public readonly updatedAt: Date;

  constructor(params: DatasetWorkflowState) {
    this.datasetId = requireText(params.datasetId, "DatasetWorkflow.datasetId");
    this.versionId = requireText(params.versionId, "DatasetWorkflow.versionId");
    this.currentStage = params.currentStage;
    this.completedStages = Object.freeze([...params.completedStages]);
    this.stageStates = Object.freeze(params.stageStates.map((state) => Object.freeze({ stage: state.stage, status: state.status })));
    this.progressPercent = params.progressPercent;
    this.lastVisitedStage = params.lastVisitedStage;
    this.updatedAt = new Date(params.updatedAt);
  }

  public withState(params: {
    readonly currentStage: DatasetWorkflowStage;
    readonly completedStages: ReadonlyArray<DatasetWorkflowStage>;
    readonly stageStates: ReadonlyArray<DatasetWorkflowStageState>;
  }): DatasetWorkflow {
    const stageCount = params.stageStates.length || 1;
    const completedCount = params.stageStates.filter((state) => state.status === "completed").length;
    return new DatasetWorkflow({
      datasetId: this.datasetId,
      versionId: this.versionId,
      currentStage: params.currentStage,
      completedStages: params.completedStages,
      stageStates: params.stageStates,
      progressPercent: Math.round((completedCount / stageCount) * 100),
      lastVisitedStage: params.currentStage,
      updatedAt: new Date(),
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
  public readonly selectedVersionId?: string;
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
    selectedVersionId?: string;
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
    this.selectedVersionId = params.selectedVersionId?.trim() || this.latestVersionId;
    this.createdBy = requireText(params.createdBy, "TuningDataset.createdBy");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
    this.updatedAt = cloneDate(params.updatedAt) ?? this.createdAt;
    this.archivedAt = cloneDate(params.archivedAt);
  }

  public withVersionPointers(version: TuningDatasetVersion, selectedVersionId = version.id): TuningDataset {
    return new TuningDataset({
      id: this.id,
      name: this.name,
      description: this.description,
      taskType: this.taskType,
      status: version.status,
      tags: this.tags,
      latestVersionId: version.id,
      selectedVersionId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      archivedAt: this.archivedAt,
    });
  }

  public selectVersion(versionId: string): TuningDataset {
    return new TuningDataset({
      id: this.id,
      name: this.name,
      description: this.description,
      taskType: this.taskType,
      status: this.status,
      tags: this.tags,
      latestVersionId: this.latestVersionId,
      selectedVersionId: requireText(versionId, "TuningDataset.selectedVersionId"),
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
      selectedVersionId: this.selectedVersionId,
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
      selectedVersionId: this.selectedVersionId,
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
    this.byteLength = params.byteLength ?? new TextEncoder().encode(params.content).byteLength;
    this.checksum = requireText(params.checksum, "DatasetExportRecord.checksum");
    this.createdAt = cloneDate(params.createdAt) ?? new Date();
  }
}

export function deriveWorkflowStageState(stage: DatasetWorkflowStage, status: WorkflowStageStatus): DatasetWorkflowStageState {
  return Object.freeze({ stage, status });
}
