import {
  ChatCompletionExample,
  DatasetExportRecord,
  DatasetReleaseManifest,
  DatasetWorkflow,
  ExampleAnnotation,
  ExampleLineage,
  QuestionAnsweringExample,
  SourceDocumentReference,
  SourceSegmentReference,
  TuningDataset,
  TuningDatasetVersion,
  ValidationIssue,
  deriveWorkflowStageState,
} from "./TuningDatasetEntities";
import type {
  ChatCompletionMessage,
  Dataset,
  DatasetDuplicationPolicy,
  DatasetExample,
  DatasetExportService,
  DatasetFactory,
  DatasetGenerationConfiguration,
  DatasetGenerationRequest,
  DatasetGenerationResult,
  DatasetGenerationService,
  DatasetImportService,
  DatasetPrivacyPolicy,
  DatasetReleasePolicy,
  DatasetReviewPolicy,
  DatasetSplitService,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetValidationService,
  DatasetVersion,
  DatasetWorkflowService,
  ExportFormat,
  ExampleStatus,
  SourceImportRequest,
  SourceImportResult,
} from "./interfaces/ITuningDatasetStudio";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function checksum(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `chk_${Math.abs(hash)}`;
}

function sentenceChunks(value: string): ReadonlyArray<string> {
  const normalized = value.replace(/\r/g, "").trim();
  if (!normalized) {
    return Object.freeze([]);
  }

  const paragraphs = normalized.split(/\n\s*\n/g).map((chunk) => normalizeWhitespace(chunk)).filter(Boolean);
  if (paragraphs.length > 0) {
    return Object.freeze(paragraphs);
  }

  return Object.freeze(
    normalized
      .split(/(?<=[.!?])\s+/)
      .map((chunk) => normalizeWhitespace(chunk))
      .filter((chunk) => chunk.length > 30),
  );
}

function pickTopic(chunk: string, fallback: string): string {
  const match = chunk.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/);
  return match?.[1] ?? fallback;
}

function schemaForTaskType(taskType: Dataset["taskType"]): DatasetVersion["schema"] {
  if (taskType === "question_answering") {
    return {
      taskType,
      schemaVersion: "2.0.0",
      canonicalExampleType: "generative_qa",
      requiredFields: ["question", "answer", "context", "split", "status"],
    };
  }

  if (taskType === "chat_completion") {
    return {
      taskType,
      schemaVersion: "2.0.0",
      canonicalExampleType: "chat_messages",
      requiredFields: ["messages", "split", "status"],
    };
  }

  return {
    taskType,
    schemaVersion: "2.0.0",
    canonicalExampleType: taskType,
    requiredFields: ["split", "status"],
  };
}

function exampleFingerprint(example: DatasetExample): string {
  if (example instanceof QuestionAnsweringExample || example.taskType === "question_answering") {
    const qaExample = example as QuestionAnsweringExample;
    return `${normalizeWhitespace(qaExample.question).toLowerCase()}::${normalizeWhitespace(qaExample.answer).toLowerCase()}`;
  }

  if (example instanceof ChatCompletionExample || example.taskType === "chat_completion") {
    const chatExample = example as ChatCompletionExample;
    return chatExample.messages.map((message) => `${message.role}:${normalizeWhitespace(message.content).toLowerCase()}`).join("|");
  }

  return `${example.taskType}:${example.id}`;
}

function acceptedOrRejectedOnly(examples: ReadonlyArray<DatasetExample>): boolean {
  return examples.every((example) => example.status === "accepted" || example.status === "rejected");
}

function allSplitsPresent(examples: ReadonlyArray<DatasetExample>): boolean {
  if (examples.length === 0) {
    return false;
  }

  if (examples.length < 3) {
    return examples.every((example) => example.split === "train" || example.split === "validation" || example.split === "test");
  }

  const trainCount = examples.filter((example) => example.split === "train").length;
  return trainCount > 0 && examples.some((example) => example.split === "validation") && examples.some((example) => example.split === "test");
}

export class TuningDatasetFactory implements DatasetFactory {
  public createDataset(params: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly taskType: Dataset["taskType"];
    readonly tags?: ReadonlyArray<string>;
    readonly createdBy: string;
    readonly createdAt?: Date;
  }): Dataset {
    return new TuningDataset(params);
  }

  public createVersion(params: {
    readonly id: string;
    readonly datasetId: string;
    readonly taskType: Dataset["taskType"];
    readonly versionNumber: number;
    readonly createdBy: string;
    readonly createdAt?: Date;
    readonly kind?: DatasetVersion["kind"];
    readonly parentVersionId?: string;
    readonly sourceVersionId?: string;
    readonly comparisonLabel?: string;
  }): DatasetVersion {
    return new TuningDatasetVersion({
      id: params.id,
      datasetId: params.datasetId,
      versionNumber: params.versionNumber,
      createdBy: params.createdBy,
      createdAt: params.createdAt,
      kind: params.kind,
      parentVersionId: params.parentVersionId,
      sourceVersionId: params.sourceVersionId,
      comparisonLabel: params.comparisonLabel,
      schema: schemaForTaskType(params.taskType),
    });
  }
}

export class DefaultDatasetReviewPolicy implements DatasetReviewPolicy {
  public canTransition(currentStatus: ExampleStatus, nextStatus: ExampleStatus): boolean {
    const allowedTransitions = {
      draft: ["accepted", "rejected", "needs_review", "draft"],
      accepted: ["accepted", "rejected", "needs_review"],
      rejected: ["accepted", "rejected", "needs_review"],
      needs_review: ["accepted", "rejected", "needs_review"],
    } as const satisfies Readonly<Record<ExampleStatus, ReadonlyArray<ExampleStatus>>>;

    return allowedTransitions[currentStatus].includes(nextStatus);
  }
}

export class DefaultDatasetPrivacyPolicy implements DatasetPrivacyPolicy {
  public sanitizeSourceText(value: string): string {
    return normalizeWhitespace(
      value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
        .replace(/\b\d{3}[-.\s]?\d{2,3}[-.\s]?\d{4}\b/g, "[redacted-number]"),
    );
  }
}

export class DefaultDatasetDuplicationPolicy implements DatasetDuplicationPolicy {
  public detectDuplicates(examples: ReadonlyArray<DatasetExample>): ReadonlyArray<{ fingerprint: string; exampleIds: ReadonlyArray<string> }> {
    const groups = new Map<string, string[]>();

    for (const example of examples) {
      const fingerprint = exampleFingerprint(example);
      groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), example.id]);
    }

    return Object.freeze(
      [...groups.entries()]
        .filter(([, exampleIds]) => exampleIds.length > 1)
        .map(([fingerprint, exampleIds]) => Object.freeze({ fingerprint, exampleIds: Object.freeze(exampleIds) })),
    );
  }
}

export class TaskTypeAwareValidationService implements DatasetValidationService {
  constructor(private readonly duplicationPolicy: DatasetDuplicationPolicy) {}

  public validateVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly sourceDocuments: ReadonlyArray<SourceDocumentReference>;
  }): DatasetValidationResult {
    const issues: ValidationIssue[] = [];

    if (params.examples.length === 0) {
      issues.push(new ValidationIssue({
        id: createId("validation"),
        severity: "error",
        code: "no-examples",
        message: "At least one example is required before validation can pass.",
        stage: "example_generation",
      }));
    }

    if (params.dataset.taskType === "question_answering") {
      this.validateQuestionAnsweringExamples(params.examples, issues);
    } else if (params.dataset.taskType === "chat_completion") {
      this.validateChatCompletionExamples(params.examples, issues);
    } else {
      issues.push(new ValidationIssue({
        id: createId("validation"),
        severity: "error",
        code: "unsupported-task-type",
        message: `Task type '${params.dataset.taskType}' is not implemented for validation.`,
        stage: "validation",
      }));
    }

    if (params.sourceDocuments.length === 0) {
      issues.push(new ValidationIssue({
        id: createId("validation"),
        severity: "warning",
        code: "no-sources",
        message: "No source documents are attached to this dataset version.",
        stage: "source_ingestion",
      }));
    }

    for (const duplicate of this.duplicationPolicy.detectDuplicates(params.examples)) {
      for (const exampleId of duplicate.exampleIds) {
        issues.push(new ValidationIssue({
          id: createId("validation"),
          severity: "warning",
          code: "duplicate-example",
          message: `Example duplicates fingerprint '${duplicate.fingerprint}'.`,
          exampleId,
          stage: "review_editing",
        }));
      }
    }

    if (!acceptedOrRejectedOnly(params.examples)) {
      issues.push(new ValidationIssue({
        id: createId("validation"),
        severity: "error",
        code: "review-incomplete",
        message: "All examples must be reviewed into accepted or rejected state before release.",
        stage: "review_editing",
      }));
    }

    if (!allSplitsPresent(params.examples)) {
      issues.push(new ValidationIssue({
        id: createId("validation"),
        severity: "error",
        code: "splits-incomplete",
        message: "Split assignment is incomplete for release readiness.",
        stage: "split_assignment",
      }));
    }

    const blockingIssueCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const readiness = Object.freeze({
      isReady: blockingIssueCount === 0,
      reviewReady: acceptedOrRejectedOnly(params.examples),
      splitReady: allSplitsPresent(params.examples),
      exportReady: params.version.status === "released" || blockingIssueCount === 0,
      blockingReasons: Object.freeze(issues.filter((issue) => issue.severity === "error").map((issue) => issue.message)),
    });

    return Object.freeze({
      datasetId: params.dataset.id,
      versionId: params.version.id,
      validatedAt: new Date(),
      issues: Object.freeze(issues),
      isValid: blockingIssueCount === 0,
      blockingIssueCount,
      warningCount,
      readiness,
    });
  }

  private validateQuestionAnsweringExamples(examples: ReadonlyArray<DatasetExample>, issues: ValidationIssue[]): void {
    for (const example of examples) {
      if (!(example instanceof QuestionAnsweringExample) && example.taskType !== "question_answering") {
        issues.push(new ValidationIssue({
          id: createId("validation"),
          severity: "error",
          code: "unsupported-example-type",
          message: "Only question answering examples are allowed in a QA dataset version.",
          exampleId: example.id,
        }));
        continue;
      }

      const qaExample = example as QuestionAnsweringExample;
      if (!qaExample.question.trim()) {
        issues.push(new ValidationIssue({ severity: "error", code: "empty-question", message: "Question must be non-empty.", exampleId: qaExample.id, field: "question" }));
      }
      if (!qaExample.answer.trim()) {
        issues.push(new ValidationIssue({ severity: "error", code: "empty-answer", message: "Answer must be non-empty.", exampleId: qaExample.id, field: "answer" }));
      }
      if (!qaExample.context.trim()) {
        issues.push(new ValidationIssue({ severity: "error", code: "empty-context", message: "Context must be non-empty for generative QA.", exampleId: qaExample.id, field: "context" }));
      }
      if (qaExample.answer.length > qaExample.context.length * 1.25) {
        issues.push(new ValidationIssue({ severity: "warning", code: "answer-longer-than-context", message: "Answer appears significantly longer than source context.", exampleId: qaExample.id, field: "answer" }));
      }
    }
  }

  private validateChatCompletionExamples(examples: ReadonlyArray<DatasetExample>, issues: ValidationIssue[]): void {
    for (const example of examples) {
      if (!(example instanceof ChatCompletionExample) && example.taskType !== "chat_completion") {
        issues.push(new ValidationIssue({
          id: createId("validation"),
          severity: "error",
          code: "unsupported-example-type",
          message: "Only chat completion examples are allowed in a chat dataset version.",
          exampleId: example.id,
        }));
        continue;
      }

      const chatExample = example as ChatCompletionExample;
      if (chatExample.messages.length < 2) {
        issues.push(new ValidationIssue({ severity: "error", code: "chat-too-short", message: "Chat examples require at least two messages.", exampleId: chatExample.id, field: "messages" }));
      }
      if (chatExample.messages[chatExample.messages.length - 1]?.role !== "assistant") {
        issues.push(new ValidationIssue({ severity: "error", code: "chat-missing-assistant-finish", message: "Chat examples must end with an assistant message.", exampleId: chatExample.id, field: "messages" }));
      }
      if (!chatExample.messages.some((message) => message.role === "user")) {
        issues.push(new ValidationIssue({ severity: "error", code: "chat-missing-user", message: "Chat examples must include at least one user message.", exampleId: chatExample.id, field: "messages" }));
      }
    }
  }
}

export class DefaultDatasetReleasePolicy implements DatasetReleasePolicy {
  public evaluate(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly validation?: DatasetValidationResult;
  }) {
    const blockingReasons: string[] = [];

    if (!params.version.isMutable) {
      blockingReasons.push("Version must be mutable before release.");
    }
    if (params.version.status === "released") {
      blockingReasons.push("Version is already released.");
    }
    if (!params.validation) {
      blockingReasons.push("Validation must run before release.");
    } else if (!params.validation.isValid || params.validation.blockingIssueCount > 0) {
      blockingReasons.push("Validation contains blocking errors.");
    }
    if ((params.validation?.readiness.reviewReady ?? false) === false) {
      blockingReasons.push("Review must be complete before release.");
    }
    if ((params.validation?.readiness.splitReady ?? false) === false) {
      blockingReasons.push("Split readiness must pass before release.");
    }
    if (params.examples.length === 0) {
      blockingReasons.push("Release requires at least one example.");
    }

    return Object.freeze({
      isReady: blockingReasons.length === 0,
      reviewReady: params.validation?.readiness.reviewReady ?? false,
      splitReady: params.validation?.readiness.splitReady ?? false,
      exportReady: blockingReasons.length === 0,
      blockingReasons: Object.freeze(blockingReasons),
    });
  }
}

export class DeterministicDatasetSplitService implements DatasetSplitService {
  public assign(examples: ReadonlyArray<DatasetExample>, actor: string): ReadonlyArray<DatasetExample> {
    void actor;
    const ordered = [...examples].sort((left, right) => left.id.localeCompare(right.id));
    return Object.freeze(ordered.map((example, index) => {
      const split = index % 10 === 0 ? "test" : index % 5 === 0 ? "validation" : "train";
      if (example instanceof QuestionAnsweringExample) {
        return example.withContent({ split });
      }
      if (example instanceof ChatCompletionExample) {
        return example.withContent({ split });
      }
      return example;
    }));
  }
}

export class DatasetStatisticsService {
  constructor(private readonly duplicationPolicy: DatasetDuplicationPolicy) {}

  public compute(datasetId: string, versionId: string, examples: ReadonlyArray<DatasetExample>, sourceDocumentCount: number): DatasetStatistics {
    const qaExamples = examples.filter((example): example is QuestionAnsweringExample => example instanceof QuestionAnsweringExample);
    const chatExamples = examples.filter((example): example is ChatCompletionExample => example instanceof ChatCompletionExample);
    const safeAverage = (values: number[]): number => values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;

    return Object.freeze({
      datasetId,
      versionId,
      exampleCount: examples.length,
      sourceDocumentCount,
      duplicateCount: this.duplicationPolicy.detectDuplicates(examples).length,
      acceptedCount: examples.filter((example) => example.status === "accepted").length,
      rejectedCount: examples.filter((example) => example.status === "rejected").length,
      draftCount: examples.filter((example) => example.status === "draft").length,
      needsReviewCount: examples.filter((example) => example.status === "needs_review").length,
      splitCounts: Object.freeze({
        train: examples.filter((example) => example.split === "train").length,
        validation: examples.filter((example) => example.split === "validation").length,
        test: examples.filter((example) => example.split === "test").length,
      }),
      averageQuestionLength: safeAverage(qaExamples.map((example) => example.question.length)),
      averageAnswerLength: safeAverage(qaExamples.map((example) => example.answer.length)),
      averageContextLength: safeAverage(qaExamples.map((example) => example.context.length)),
      averageMessageCount: safeAverage(chatExamples.map((example) => example.messages.length)),
    });
  }
}

export class DatasetLineageService {
  public captureFromSource(sourceDocumentId: string, metadata?: Readonly<Record<string, unknown>>) {
    return ExampleLineage.generatedFromSource(sourceDocumentId, metadata);
  }
}

export class ReleaseManifestService {
  public create(params: {
    dataset: Dataset;
    version: DatasetVersion;
    examples: ReadonlyArray<DatasetExample>;
    sourceDocumentCount: number;
  }): DatasetReleaseManifest {
    const signature = JSON.stringify({
      datasetId: params.dataset.id,
      versionId: params.version.id,
      exampleIds: params.examples.map((example) => example.id).sort(),
      releasedAt: params.version.releasedAt?.toISOString() ?? params.version.updatedAt.toISOString(),
      sourceDocumentCount: params.sourceDocumentCount,
    });

    return new DatasetReleaseManifest({
      datasetId: params.dataset.id,
      versionId: params.version.id,
      checksum: checksum(signature),
      metadata: {
        taskType: params.dataset.taskType,
        exampleCount: params.examples.length,
        sourceDocumentCount: params.sourceDocumentCount,
      },
    });
  }
}

export class BrowserDatasetImportService implements DatasetImportService {
  constructor(private readonly privacyPolicy: DatasetPrivacyPolicy) {}

  public importSourceDocuments(params: SourceImportRequest): SourceImportResult {
    const seenChecksums = new Set<string>();
    const documents: SourceDocumentReference[] = [];
    let duplicateCount = 0;

    for (const document of params.documents) {
      const normalizedContent = this.privacyPolicy.sanitizeSourceText(document.content);
      const docChecksum = checksum(`${document.name}:${normalizedContent}`);
      if (seenChecksums.has(docChecksum)) {
        duplicateCount += 1;
        continue;
      }
      seenChecksums.add(docChecksum);
      const chunks = sentenceChunks(normalizedContent);
      const segments = chunks.map((chunk, index) => new SourceSegmentReference({
        id: createId("segment"),
        sourceDocumentId: document.id?.trim() || createId("source_doc"),
        index,
        kind: chunks.length > 1 ? "paragraph" : "document",
        text: chunk,
        checksum: checksum(chunk),
      }));
      const sourceDocumentId = document.id?.trim() || createId("source_doc");
      documents.push(new SourceDocumentReference({
        id: sourceDocumentId,
        datasetId: params.datasetId,
        versionId: params.versionId,
        name: document.name,
        content: normalizedContent,
        normalizedContent,
        checksum: docChecksum,
        sourceType: document.sourceType ?? "manual_text",
        mediaType: document.mediaType ?? "text/plain",
        createdBy: params.createdBy,
        createdAt: new Date(),
        segments: segments.map((segment) => ({ ...segment, sourceDocumentId })),
        metadata: document.metadata,
      }));
    }

    return Object.freeze({
      documents: Object.freeze(documents),
      importedCount: documents.length,
      duplicateCount,
    });
  }
}

class HeuristicQuestionAnsweringGenerator {
  public generate(request: DatasetGenerationRequest, configuration: DatasetGenerationConfiguration | undefined): DatasetGenerationResult {
    const examples: QuestionAnsweringExample[] = [];
    const existingFingerprints = new Set(request.existingExamples.map((example) => exampleFingerprint(example)));
    const maxSegments = configuration?.maxSegmentsPerSource ?? 8;

    for (const sourceDocument of request.sourceDocuments) {
      const segments = sourceDocument.segments.length > 0 ? sourceDocument.segments : sentenceChunks(sourceDocument.content).map((text, index) => ({ id: `${sourceDocument.id}-${index}`, sourceDocumentId: sourceDocument.id, index, kind: "paragraph" as const, text, checksum: checksum(text) }));
      for (const segment of segments.slice(0, maxSegments)) {
        if (segment.text.length < 50) {
          continue;
        }

        const topic = pickTopic(segment.text, sourceDocument.name);
        const question = `What should a model know about ${topic}?`;
        const answer = segment.text.length > 320 ? `${segment.text.slice(0, 317).trimEnd()}...` : segment.text;
        const fingerprint = `${question.toLowerCase()}::${answer.toLowerCase()}`;
        if (existingFingerprints.has(fingerprint)) {
          continue;
        }
        existingFingerprints.add(fingerprint);
        examples.push(new QuestionAnsweringExample({
          id: createId("qa_example"),
          datasetId: request.datasetId,
          versionId: request.versionId,
          question,
          answer,
          context: segment.text,
          sourceDocumentId: sourceDocument.id,
          sourceMetadata: { sourceName: sourceDocument.name, chunkIndex: segment.index },
          createdBy: request.createdBy,
        }));
      }
    }

    const startedAt = new Date();
    const batchId = createId("generation_batch");
    const executedAt = new Date();
    return Object.freeze({
      batchId,
      datasetId: request.datasetId,
      versionId: request.versionId,
      taskType: request.taskType,
      generatedAt: executedAt,
      examples: Object.freeze(examples),
      provenance: Object.freeze({
        provider: "local-browser",
        generatorId: "heuristic-question-answering",
        generatorVersion: "2.0.0",
        batchId: batchId,
        mode: "heuristic-fallback" as const,
        executionKind: "heuristic-fallback" as const,
        status: "degraded" as const,
        path: "browser://heuristic-question-answering",
        isFallback: true,
        isDegraded: true,
        detail: "The browser heuristic fallback generated examples because provider/model-backed generation was unavailable or explicitly bypassed.",
        parameters: Object.freeze({ strategy: configuration?.strategy ?? "heuristic_qa", maxSegments }),
        startedAt,
        executedAt,
        durationMs: Math.max(executedAt.getTime() - startedAt.getTime(), 0),
        diagnostics: Object.freeze([]),
        fallbackReason: "Provider/model-backed generation was unavailable or bypassed.",
        fallback: Object.freeze({ fromMode: "provider-model-backed" as const, reason: "Provider/model-backed generation was unavailable or bypassed." }),
      }),
      generatedCount: examples.length,
      skippedCount: 0,
      status: "degraded" as const,
    });
  }
}

class HeuristicChatCompletionGenerator {
  public generate(request: DatasetGenerationRequest, configuration: DatasetGenerationConfiguration | undefined): DatasetGenerationResult {
    const examples: ChatCompletionExample[] = [];
    const existingFingerprints = new Set(request.existingExamples.map((example) => exampleFingerprint(example)));
    const maxSegments = configuration?.maxSegmentsPerSource ?? 6;

    for (const sourceDocument of request.sourceDocuments) {
      const segments = sourceDocument.segments.length > 0 ? sourceDocument.segments : sentenceChunks(sourceDocument.content).map((text, index) => ({ id: `${sourceDocument.id}-${index}`, sourceDocumentId: sourceDocument.id, index, kind: "paragraph" as const, text, checksum: checksum(text) }));
      for (const segment of segments.slice(0, maxSegments)) {
        const topic = pickTopic(segment.text, sourceDocument.name);
        const messages: ReadonlyArray<ChatCompletionMessage> = Object.freeze([
          { role: "system", content: `You are answering questions grounded in ${sourceDocument.name}.` },
          { role: "user", content: `Summarize the most important guidance about ${topic}.` },
          { role: "assistant", content: segment.text.length > 280 ? `${segment.text.slice(0, 277).trimEnd()}...` : segment.text },
        ]);
        const fingerprint = messages.map((message) => `${message.role}:${message.content.toLowerCase()}`).join("|");
        if (existingFingerprints.has(fingerprint)) {
          continue;
        }
        existingFingerprints.add(fingerprint);
        examples.push(new ChatCompletionExample({
          id: createId("chat_example"),
          datasetId: request.datasetId,
          versionId: request.versionId,
          messages,
          createdBy: request.createdBy,
          lineage: ExampleLineage.generatedFromSource(sourceDocument.id, { sourceName: sourceDocument.name, chunkIndex: segment.index }),
        }));
      }
    }

    const startedAt = new Date();
    const batchId = createId("generation_batch");
    const executedAt = new Date();
    return Object.freeze({
      batchId,
      datasetId: request.datasetId,
      versionId: request.versionId,
      taskType: request.taskType,
      generatedAt: executedAt,
      examples: Object.freeze(examples),
      provenance: Object.freeze({
        provider: "local-browser",
        generatorId: "heuristic-chat-completion",
        generatorVersion: "2.0.0",
        batchId: batchId,
        mode: "heuristic-fallback" as const,
        executionKind: "heuristic-fallback" as const,
        status: "degraded" as const,
        path: "browser://heuristic-chat-completion",
        isFallback: true,
        isDegraded: true,
        detail: "The browser heuristic fallback generated examples because provider/model-backed generation was unavailable or explicitly bypassed.",
        parameters: Object.freeze({ strategy: configuration?.strategy ?? "heuristic_chat", maxSegments }),
        startedAt,
        executedAt,
        durationMs: Math.max(executedAt.getTime() - startedAt.getTime(), 0),
        diagnostics: Object.freeze([]),
        fallbackReason: "Provider/model-backed generation was unavailable or bypassed.",
        fallback: Object.freeze({ fromMode: "provider-model-backed" as const, reason: "Provider/model-backed generation was unavailable or bypassed." }),
      }),
      generatedCount: examples.length,
      skippedCount: 0,
      status: "degraded" as const,
    });
  }
}

export class ProviderAgnosticDatasetGenerationService implements DatasetGenerationService {
  private readonly qaGenerator = new HeuristicQuestionAnsweringGenerator();
  private readonly chatGenerator = new HeuristicChatCompletionGenerator();

  public async generate(request: DatasetGenerationRequest): Promise<DatasetGenerationResult> {
    if (request.taskType === "question_answering") {
      return this.qaGenerator.generate(request, request.configuration);
    }
    if (request.taskType === "chat_completion") {
      return this.chatGenerator.generate(request, request.configuration);
    }
    throw new Error(`Task type '${request.taskType}' is not implemented for generation.`);
  }
}

export class FallbackAwareDatasetGenerationService implements DatasetGenerationService {
  constructor(
    private readonly primary: DatasetGenerationService,
    private readonly fallback: DatasetGenerationService,
  ) {}

  public async generate(request: DatasetGenerationRequest): Promise<DatasetGenerationResult> {
    try {
      return await this.primary.generate(request);
    } catch (error) {
      const fallbackResult = await this.fallback.generate(request);
      return Object.freeze({
        ...fallbackResult,
        status: fallbackResult.examples.length > 0 ? "degraded" : "failed",
        provenance: Object.freeze({
          ...fallbackResult.provenance,
          status: fallbackResult.examples.length > 0 ? "degraded" : "failed",
          isFallback: true,
          isDegraded: fallbackResult.examples.length > 0,
          diagnostics: Object.freeze([
            ...fallbackResult.provenance.diagnostics,
            Object.freeze({
              code: "provider_runtime_unavailable",
              level: "warning" as const,
              message: error instanceof Error ? error.message : "Provider/model-backed dataset generation was unavailable.",
              detail: "Falling back to the explicit heuristic browser generator.",
            }),
          ]),
          fallbackReason: error instanceof Error ? error.message : "Provider/model-backed dataset generation was unavailable.",
          fallback: Object.freeze({
            fromMode: "provider-model-backed" as const,
            reason: error instanceof Error ? error.message : "Provider/model-backed dataset generation was unavailable.",
          }),
        }),
      });
    }
  }
}

export class DatasetWorkflowProgressService implements DatasetWorkflowService {
  private readonly orderedStages = [
    "dataset_definition",
    "source_ingestion",
    "example_generation",
    "review_editing",
    "validation",
    "split_assignment",
    "release",
    "export",
  ] as const;

  public createInitial(datasetId: string, versionId: string): DatasetWorkflow {
    return new DatasetWorkflow({
      datasetId,
      versionId,
      currentStage: "dataset_definition",
      completedStages: Object.freeze([]),
      stageStates: Object.freeze(this.orderedStages.map((stage, index) => deriveWorkflowStageState(stage, index === 0 ? "current" : "pending"))),
      progressPercent: 0,
      lastVisitedStage: "dataset_definition",
      updatedAt: new Date(),
    });
  }

  public transition(workflow: DatasetWorkflow, nextStage: DatasetWorkflow["currentStage"]): DatasetWorkflow {
    const currentIndex = this.orderedStages.indexOf(workflow.currentStage);
    const nextIndex = this.orderedStages.indexOf(nextStage);
    if (nextIndex === -1) {
      throw new Error(`Unknown workflow stage '${nextStage}'.`);
    }
    if (nextIndex > currentIndex + 1) {
      throw new Error(`Illegal workflow transition: ${workflow.currentStage} -> ${nextStage}.`);
    }

    return workflow.withState({
      currentStage: nextStage,
      completedStages: Object.freeze([...new Set([...workflow.completedStages, ...this.orderedStages.slice(0, nextIndex)])]),
      stageStates: Object.freeze(this.orderedStages.map((stage, index) => {
        if (index < nextIndex) {
          return deriveWorkflowStageState(stage, "completed");
        }
        if (index === nextIndex) {
          return deriveWorkflowStageState(stage, "current");
        }
        return deriveWorkflowStageState(stage, "pending");
      })),
    });
  }

  public reconcile(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly current?: DatasetWorkflow;
    readonly hasDefinition: boolean;
    readonly sourceCount: number;
    readonly exampleCount: number;
    readonly validation?: DatasetValidationResult;
    readonly version: DatasetVersion;
    readonly exportCount: number;
  }): DatasetWorkflow {
    const current = params.current ?? this.createInitial(params.datasetId, params.versionId);
    let nextStage: DatasetWorkflow["currentStage"] = "dataset_definition";
    if (!params.hasDefinition) {
      nextStage = "dataset_definition";
    } else if (params.sourceCount === 0) {
      nextStage = "source_ingestion";
    } else if (params.exampleCount === 0) {
      nextStage = "example_generation";
    } else if ((params.validation?.readiness.reviewReady ?? false) === false) {
      nextStage = "review_editing";
    } else if (!params.validation) {
      nextStage = "validation";
    } else if ((params.validation.readiness.splitReady ?? false) === false) {
      nextStage = "split_assignment";
    } else if (params.version.status !== "released") {
      nextStage = "release";
    } else if (params.exportCount === 0) {
      nextStage = "export";
    } else {
      nextStage = "export";
    }

    const nextIndex = this.orderedStages.indexOf(nextStage);
    return current.withState({
      currentStage: nextStage,
      completedStages: Object.freeze(this.orderedStages.filter((_, index) => index < nextIndex)),
      stageStates: Object.freeze(this.orderedStages.map((stage, index) => {
        if (index < nextIndex) {
          return deriveWorkflowStageState(stage, "completed");
        }
        if (index === nextIndex) {
          return deriveWorkflowStageState(stage, "current");
        }
        return deriveWorkflowStageState(stage, "pending");
      })),
    });
  }
}

export class JsonTuningDatasetExportService implements DatasetExportService {
  public exportVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
    readonly sourceDocuments: ReadonlyArray<SourceDocumentReference>;
    readonly format: ExportFormat;
    readonly manifest: { readonly id: string; readonly createdAt: Date; readonly checksum: string; readonly metadata: Readonly<Record<string, unknown>> };
  }): DatasetExportRecord {
    if (params.version.status !== "released") {
      throw new Error("Exports must reference an immutable released version.");
    }

    const fileNameBase = `${params.dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${params.version.versionNumber}`;
    const canonicalPayload = {
      dataset: params.dataset,
      version: params.version,
      manifest: params.manifest,
      sourceDocuments: params.sourceDocuments,
      examples: params.examples.map((example) => {
        if (example instanceof QuestionAnsweringExample) {
          return {
            type: "question_answering",
            id: example.id,
            question: example.question,
            answer: example.answer,
            context: example.context,
            sourceDocumentId: example.sourceDocumentId,
            split: example.split,
            status: example.status,
            tags: example.tags,
          };
        }
        const chatExample = example as ChatCompletionExample;
        return {
          type: "chat_completion",
          id: chatExample.id,
          messages: chatExample.messages,
          split: chatExample.split,
          status: chatExample.status,
          tags: chatExample.tags,
        };
      }),
    };

    const content = params.format === "canonical_json"
      ? JSON.stringify(canonicalPayload, null, 2)
      : params.format === "canonical_jsonl"
        ? params.examples.map((example) => JSON.stringify(example instanceof QuestionAnsweringExample
          ? {
              type: "question_answering",
              datasetId: example.datasetId,
              versionId: example.versionId,
              id: example.id,
              question: example.question,
              answer: example.answer,
              context: example.context,
              sourceDocumentId: example.sourceDocumentId,
              split: example.split,
              status: example.status,
              tags: example.tags,
            }
          : {
              type: "chat_completion",
              datasetId: example.datasetId,
              versionId: example.versionId,
              id: example.id,
              messages: (example as ChatCompletionExample).messages,
              split: example.split,
              status: example.status,
              tags: example.tags,
            })).join("\n")
        : params.format === "openai_chat_jsonl"
          ? params.examples.filter((example): example is ChatCompletionExample => example instanceof ChatCompletionExample).map((example) => JSON.stringify({ messages: example.messages })).join("\n")
          : params.format === "qa_jsonl"
            ? params.examples.filter((example): example is QuestionAnsweringExample => example instanceof QuestionAnsweringExample).map((example) => JSON.stringify({
                question: example.question,
                answer: example.answer,
                context: example.context,
                metadata: {
                  id: example.id,
                  sourceDocumentId: example.sourceDocumentId,
                  split: example.split,
                  status: example.status,
                  tags: example.tags,
                },
              })).join("\n")
            : params.examples.filter((example): example is ChatCompletionExample => example instanceof ChatCompletionExample).map((example) => JSON.stringify({
                messages: example.messages,
                metadata: {
                  id: example.id,
                  split: example.split,
                  status: example.status,
                  tags: example.tags,
                },
              })).join("\n");

    const extension = params.format === "canonical_json" ? "json" : "jsonl";
    return new DatasetExportRecord({
      id: createId("export"),
      datasetId: params.dataset.id,
      versionId: params.version.id,
      format: params.format,
      fileName: `${fileNameBase}.${extension}`,
      contentType: params.format === "canonical_json" ? "application/json" : "application/x-ndjson",
      content,
      checksum: checksum(content),
      createdAt: new Date(),
    });
  }
}

export function createReviewAnnotation(author: string, note: string): ExampleAnnotation {
  return new ExampleAnnotation({ author, note });
}
