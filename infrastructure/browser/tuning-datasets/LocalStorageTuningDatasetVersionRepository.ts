import {
  DatasetExportRecord,
  ExampleAnnotation,
  ExampleLineage,
  QuestionAnsweringExample,
  SourceDocumentReference,
  TuningDatasetVersion,
  ValidationIssue,
} from "../../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  DatasetExample,
  DatasetExportArtifact,
  DatasetValidationResult,
  DatasetVersion,
  DatasetVersionRepository,
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
  readonly question: string;
  readonly answer: string;
  readonly context: string;
  readonly sourceDocumentId?: string;
  readonly sourceOffsets?: Readonly<{ start: number; end: number }>;
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
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
  readonly createdBy: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface SerializedValidationIssue {
  readonly id: string;
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly exampleId?: string;
  readonly field?: string;
}

interface SerializedValidationResult {
  readonly datasetId: string;
  readonly versionId: string;
  readonly validatedAt: string;
  readonly issues: ReadonlyArray<SerializedValidationIssue>;
  readonly isValid: boolean;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
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
const exportStorageKey = "ai-loom-studio.tuning-dataset-exports";

function matchVersion(record: { datasetId: string; versionId?: string; id?: string }, datasetId: string, versionId: string): boolean {
  return record.datasetId === datasetId && (("versionId" in record && record.versionId === versionId) || ("id" in record && record.id === versionId));
}

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
    return this.readCollection<VersionRecord>(versionStorageKey)
      .find((record) => record.datasetId === datasetId && record.id === versionId)
      ? this.toVersion(this.readCollection<VersionRecord>(versionStorageKey).find((record) => record.datasetId === datasetId && record.id === versionId) as VersionRecord)
      : undefined;
  }

  public async listVersions(datasetId: string): Promise<ReadonlyArray<DatasetVersion>> {
    return Object.freeze(this.readCollection<VersionRecord>(versionStorageKey)
      .filter((record) => record.datasetId === datasetId)
      .sort((left, right) => left.versionNumber - right.versionNumber)
      .map((record) => this.toVersion(record)));
  }

  public async saveExample(example: DatasetExample): Promise<DatasetExample> {
    const examples = this.readCollection<ExampleRecord>(exampleStorageKey);
    const record = this.toExampleRecord(example as QuestionAnsweringExample);
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
      .filter((record) => !query || [record.question, record.answer, record.context].some((value) => value.toLowerCase().includes(query)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => this.toExample(record)));
  }

  public async saveSourceDocument(document: SourceDocumentReference): Promise<void> {
    const sources = this.readCollection<SourceDocumentRecord>(sourceStorageKey);
    const record = {
      id: document.id,
      datasetId: document.datasetId,
      versionId: document.versionId,
      name: document.name,
      content: document.content,
      createdBy: document.createdBy,
      createdAt: document.createdAt.toISOString(),
      metadata: document.metadata,
    };
    this.upsert(sources, record, (current) => current.id === document.id && current.datasetId === document.datasetId && current.versionId === document.versionId, sourceStorageKey);
  }

  public async listSourceDocuments(datasetId: string, versionId: string): Promise<ReadonlyArray<SourceDocumentReference>> {
    return Object.freeze(this.readCollection<SourceDocumentRecord>(sourceStorageKey)
      .filter((record) => record.datasetId === datasetId && record.versionId === versionId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((record) => new SourceDocumentReference({
        id: record.id,
        datasetId: record.datasetId,
        versionId: record.versionId,
        name: record.name,
        content: record.content,
        createdBy: record.createdBy,
        createdAt: new Date(record.createdAt),
        metadata: record.metadata,
      })));
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

  public async saveExportArtifact(artifact: DatasetExportArtifact): Promise<DatasetExportArtifact> {
    const exports = this.readCollection<ExportRecord>(exportStorageKey);
    const record = {
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
    this.upsert(exports, record, (current) => current.id === artifact.id, exportStorageKey);
    return this.toExport(record);
  }

  public async listExportArtifacts(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>> {
    return Object.freeze(this.readCollection<ExportRecord>(exportStorageKey)
      .filter((record) => record.datasetId === datasetId && record.versionId === versionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => this.toExport(record)));
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
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      releasedAt: record.releasedAt ? new Date(record.releasedAt) : undefined,
      releaseNotes: record.releaseNotes,
      validationResult: record.validationResult ? this.toValidationResult(record.validationResult) : undefined,
      statistics: record.statistics,
      schema: record.schema,
    });
  }

  private toExampleRecord(example: QuestionAnsweringExample): ExampleRecord {
    return {
      id: example.id,
      datasetId: example.datasetId,
      versionId: example.versionId,
      question: example.question,
      answer: example.answer,
      context: example.context,
      sourceDocumentId: example.sourceDocumentId,
      sourceOffsets: example.sourceOffsets,
      sourceMetadata: example.sourceMetadata,
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
      },
      validationIssues: example.validationIssues.map((issue) => ({ ...issue })),
      annotations: example.annotations.map((annotation) => ({
        id: annotation.id,
        author: annotation.author,
        note: annotation.note,
        createdAt: annotation.createdAt.toISOString(),
      })),
    };
  }

  private toExample(record: ExampleRecord): DatasetExample {
    return new QuestionAnsweringExample({
      id: record.id,
      datasetId: record.datasetId,
      versionId: record.versionId,
      question: record.question,
      answer: record.answer,
      context: record.context,
      sourceDocumentId: record.sourceDocumentId,
      sourceOffsets: record.sourceOffsets,
      sourceMetadata: record.sourceMetadata,
      split: record.split,
      status: record.status,
      tags: record.tags,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      lineage: new ExampleLineage({
        sourceDocumentId: record.lineage.sourceDocumentId,
        generatedFromExampleId: record.lineage.generatedFromExampleId,
        generationMethod: record.lineage.generationMethod,
        promptTemplateVersion: record.lineage.promptTemplateVersion,
        capturedAt: new Date(record.lineage.capturedAt),
        metadata: record.lineage.metadata,
      }),
      validationIssues: record.validationIssues.map((issue) => new ValidationIssue(issue)),
      annotations: record.annotations.map((annotation) => new ExampleAnnotation({
        id: annotation.id,
        author: annotation.author,
        note: annotation.note,
        createdAt: new Date(annotation.createdAt),
      })),
    });
  }

  private toValidationRecord(result: DatasetValidationResult): SerializedValidationResult {
    return {
      datasetId: result.datasetId,
      versionId: result.versionId,
      validatedAt: result.validatedAt.toISOString(),
      issues: result.issues.map((issue) => ({ ...issue })),
      isValid: result.isValid,
      blockingIssueCount: result.blockingIssueCount,
      warningCount: result.warningCount,
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
    });
  }

  private toExport(record: ExportRecord): DatasetExportArtifact {
    return new DatasetExportRecord({
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
}
