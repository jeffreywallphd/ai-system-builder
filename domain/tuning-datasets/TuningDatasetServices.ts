import {
  DatasetExportRecord,
  DatasetReleaseManifest,
  ExampleAnnotation,
  ExampleLineage,
  QuestionAnsweringExample,
  SourceDocumentReference,
  TuningDataset,
  TuningDatasetVersion,
  ValidationIssue,
} from "./TuningDatasetEntities";
import type {
  Dataset,
  DatasetDuplicationPolicy,
  DatasetExample,
  DatasetExportService,
  DatasetFactory,
  DatasetGenerationService,
  DatasetImportService,
  DatasetPrivacyPolicy,
  DatasetReviewPolicy,
  DatasetSplitService,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetValidationService,
  DatasetVersion,
  ExportFormat,
  ExampleStatus,
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
      .filter((chunk) => chunk.length > 40),
  );
}

function pickTopic(chunk: string, fallback: string): string {
  const match = chunk.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/);
  return match?.[1] ?? fallback;
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
  }): DatasetVersion {
    return new TuningDatasetVersion({
      id: params.id,
      datasetId: params.datasetId,
      versionNumber: params.versionNumber,
      createdBy: params.createdBy,
      createdAt: params.createdAt,
      schema: {
        taskType: params.taskType,
        schemaVersion: "1.0.0",
        canonicalExampleType: params.taskType === "question_answering" ? "generative_qa" : params.taskType,
        requiredFields: params.taskType === "question_answering"
          ? ["question", "answer", "context", "split", "status"]
          : ["split", "status"],
      },
    });
  }
}

export class DefaultDatasetReviewPolicy implements DatasetReviewPolicy {
  public canTransition(currentStatus: ExampleStatus, nextStatus: ExampleStatus): boolean {
    const allowed = new QuestionAnsweringExample({
      id: "review-policy",
      datasetId: "dataset",
      versionId: "version",
      question: "Question?",
      answer: "Answer.",
      context: "Context.",
      createdBy: "system",
      status: currentStatus,
      lineage: new ExampleLineage({ generationMethod: "manual" }),
    });

    try {
      allowed.withStatus(nextStatus);
      return true;
    } catch {
      return false;
    }
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
      const question = "question" in example ? normalizeWhitespace(String(example.question)) : "";
      const answer = "answer" in example ? normalizeWhitespace(String(example.answer)) : "";
      const fingerprint = `${question.toLowerCase()}::${answer.toLowerCase()}`;
      groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), example.id]);
    }

    return Object.freeze(
      [...groups.entries()]
        .filter(([, exampleIds]) => exampleIds.length > 1)
        .map(([fingerprint, exampleIds]) => Object.freeze({ fingerprint, exampleIds: Object.freeze(exampleIds) })),
    );
  }
}

export class QuestionAnsweringValidationService implements DatasetValidationService {
  constructor(private readonly duplicationPolicy: DatasetDuplicationPolicy) {}

  public validateVersion(params: {
    readonly dataset: Dataset;
    readonly version: DatasetVersion;
    readonly examples: ReadonlyArray<DatasetExample>;
  }): DatasetValidationResult {
    const issues: ValidationIssue[] = [];

    if (params.dataset.taskType !== "question_answering") {
      issues.push(new ValidationIssue({
        severity: "error",
        code: "unsupported-task-type",
        message: `Task type '${params.dataset.taskType}' is modeled but not fully implemented for validation.`,
      }));
    }

    for (const example of params.examples) {
      if (!(example instanceof QuestionAnsweringExample) && example.taskType !== "question_answering") {
        issues.push(new ValidationIssue({
          severity: "error",
          code: "unsupported-example-type",
          message: "Only question answering examples are fully supported in this release.",
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
      if (qaExample.status === "draft") {
        issues.push(new ValidationIssue({ severity: "info", code: "draft-example", message: "Example is still in draft review state.", exampleId: qaExample.id, field: "status" }));
      }
    }

    for (const duplicate of this.duplicationPolicy.detectDuplicates(params.examples)) {
      for (const exampleId of duplicate.exampleIds) {
        issues.push(new ValidationIssue({
          severity: "warning",
          code: "duplicate-example",
          message: `Example duplicates fingerprint '${duplicate.fingerprint}'.`,
          exampleId,
        }));
      }
    }

    const blockingIssueCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;

    return Object.freeze({
      datasetId: params.dataset.id,
      versionId: params.version.id,
      validatedAt: new Date(),
      issues: Object.freeze(issues),
      isValid: blockingIssueCount === 0,
      blockingIssueCount,
      warningCount,
    });
  }
}

export class DeterministicDatasetSplitService implements DatasetSplitService {
  public assign(examples: ReadonlyArray<DatasetExample>, actor: string): ReadonlyArray<DatasetExample> {
    const ordered = [...examples].sort((left, right) => left.id.localeCompare(right.id));
    return Object.freeze(ordered.map((example, index) => {
      const split = index % 10 === 0 ? "test" : index % 5 === 0 ? "validation" : "train";
      if (example instanceof QuestionAnsweringExample) {
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
    });
  }
}

export class DatasetLineageService {
  public captureFromSource(sourceDocumentId: string, metadata?: Readonly<Record<string, unknown>>): ExampleLineage {
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

  public importSourceDocuments(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly createdBy: string;
    readonly documents: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly content: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }>;
  }): ReadonlyArray<SourceDocumentReference> {
    return Object.freeze(params.documents.map((document) => new SourceDocumentReference({
      ...document,
      datasetId: params.datasetId,
      versionId: params.versionId,
      createdBy: params.createdBy,
      content: this.privacyPolicy.sanitizeSourceText(document.content),
      createdAt: new Date(),
    })));
  }
}

export class HeuristicQuestionAnsweringGenerationService implements DatasetGenerationService {
  public generateQuestionAnsweringExamples(params: {
    readonly datasetId: string;
    readonly versionId: string;
    readonly createdBy: string;
    readonly sourceDocuments: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly content: string;
    }>;
    readonly existingExamples: ReadonlyArray<DatasetExample>;
  }): ReadonlyArray<DatasetExample> {
    const examples: QuestionAnsweringExample[] = [];
    const existingFingerprints = new Set(
      params.existingExamples.map((example) => `${"question" in example ? String(example.question).trim().toLowerCase() : ""}::${"answer" in example ? String(example.answer).trim().toLowerCase() : ""}`),
    );

    for (const sourceDocument of params.sourceDocuments) {
      const chunks = sentenceChunks(sourceDocument.content).slice(0, 8);
      for (const [index, chunk] of chunks.entries()) {
        if (chunk.length < 50) {
          continue;
        }

        const topic = pickTopic(chunk, sourceDocument.name);
        const question = `What should a model know about ${topic}?`;
        const answer = chunk.length > 320 ? `${chunk.slice(0, 317).trimEnd()}...` : chunk;
        const fingerprint = `${question.toLowerCase()}::${answer.toLowerCase()}`;
        if (existingFingerprints.has(fingerprint)) {
          continue;
        }

        existingFingerprints.add(fingerprint);
        examples.push(new QuestionAnsweringExample({
          id: createId("qa_example"),
          datasetId: params.datasetId,
          versionId: params.versionId,
          question,
          answer,
          context: chunk,
          sourceDocumentId: sourceDocument.id,
          sourceMetadata: { sourceName: sourceDocument.name, chunkIndex: index },
          createdBy: params.createdBy,
          lineage: ExampleLineage.generatedFromSource(sourceDocument.id, {
            sourceName: sourceDocument.name,
            chunkIndex: index,
          }),
        }));
      }
    }

    return Object.freeze(examples);
  }
}

export class JsonTuningDatasetExportService implements DatasetExportService {
  public exportVersion(params: {
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
  }): DatasetExportRecord {
    if (params.version.status !== "released") {
      throw new Error("Exports must reference an immutable released version.");
    }

    const fileNameBase = `${params.dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${params.version.versionNumber}`;
    const qaExamples = params.examples.filter((example): example is QuestionAnsweringExample => example instanceof QuestionAnsweringExample);

    const canonicalPayload = {
      dataset: params.dataset,
      version: params.version,
      manifest: params.manifest,
      sourceDocuments: params.sourceDocuments,
      examples: qaExamples.map((example) => ({
        id: example.id,
        question: example.question,
        answer: example.answer,
        context: example.context,
        sourceDocumentId: example.sourceDocumentId,
        sourceMetadata: example.sourceMetadata,
        split: example.split,
        status: example.status,
        tags: example.tags,
        createdBy: example.createdBy,
        createdAt: example.createdAt.toISOString(),
        updatedAt: example.updatedAt.toISOString(),
        lineage: {
          ...example.lineage,
          capturedAt: example.lineage.capturedAt.toISOString(),
        },
      })),
    };

    const content = params.format === "canonical_json"
      ? JSON.stringify(canonicalPayload, null, 2)
      : params.format === "canonical_jsonl"
        ? qaExamples.map((example) => JSON.stringify({
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
          })).join("\n")
        : qaExamples.map((example) => JSON.stringify({
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
