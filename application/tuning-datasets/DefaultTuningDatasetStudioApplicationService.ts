import {
  DatasetLineageService,
  DatasetStatisticsService,
  ReleaseManifestService,
  TuningDatasetFactory,
  createReviewAnnotation,
} from "../../domain/tuning-datasets/TuningDatasetServices";
import {
  ExampleLineage,
  QuestionAnsweringExample,
  TuningDataset,
  TuningDatasetVersion,
} from "../../domain/tuning-datasets/TuningDatasetEntities";
import type {
  Dataset,
  DatasetDuplicationPolicy,
  DatasetExample,
  DatasetExportArtifact,
  DatasetExportService,
  DatasetGenerationService,
  DatasetImportService,
  DatasetRepository,
  DatasetReviewPolicy,
  DatasetSplitService,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetValidationService,
  DatasetVersion,
  DatasetVersionRepository,
  ExportFormat,
  ExampleStatus,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  AddExampleCommand,
  ArchiveDatasetCommand,
  AssignSplitsAutomaticallyCommand,
  BulkAddExamplesCommand,
  BulkUpdateExampleStatusCommand,
  CreateDatasetCommand,
  CreateDatasetVersionCommand,
  DatasetDetails,
  DatasetSummary,
  DeleteExampleCommand,
  ExportDatasetVersionCommand,
  GenerateQaExamplesFromSourceCommand,
  GetDatasetDetailsQuery,
  GetExampleDetailsQuery,
  ImportSourceDocumentsCommand,
  ListDatasetsQuery,
  ListExamplesQuery,
  RegenerateQaExampleCommand,
  ReleaseDatasetVersionCommand,
  ReviewExampleCommand,
  UpdateExampleCommand,
  UpdateSplitAssignmentCommand,
  ValidateDatasetVersionCommand,
} from "./contracts";
import type { TuningDatasetStudioApplicationService } from "./TuningDatasetStudioApplicationService";

interface ServiceOptions {
  readonly datasetRepository: DatasetRepository;
  readonly datasetVersionRepository: DatasetVersionRepository;
  readonly factory?: TuningDatasetFactory;
  readonly validationService: DatasetValidationService;
  readonly splitService: DatasetSplitService;
  readonly exportService: DatasetExportService;
  readonly importService: DatasetImportService;
  readonly generationService: DatasetGenerationService;
  readonly reviewPolicy: DatasetReviewPolicy;
  readonly duplicationPolicy: DatasetDuplicationPolicy;
  readonly statisticsService: DatasetStatisticsService;
  readonly lineageService?: DatasetLineageService;
  readonly releaseManifestService?: ReleaseManifestService;
  readonly createId?: (prefix: string) => string;
}

export class DefaultTuningDatasetStudioApplicationService implements TuningDatasetStudioApplicationService {
  private readonly datasetRepository: DatasetRepository;
  private readonly datasetVersionRepository: DatasetVersionRepository;
  private readonly factory: TuningDatasetFactory;
  private readonly validationService: DatasetValidationService;
  private readonly splitService: DatasetSplitService;
  private readonly exportService: DatasetExportService;
  private readonly importService: DatasetImportService;
  private readonly generationService: DatasetGenerationService;
  private readonly reviewPolicy: DatasetReviewPolicy;
  private readonly duplicationPolicy: DatasetDuplicationPolicy;
  private readonly statisticsService: DatasetStatisticsService;
  private readonly lineageService: DatasetLineageService;
  private readonly releaseManifestService: ReleaseManifestService;
  private readonly createId: (prefix: string) => string;

  constructor(options: ServiceOptions) {
    this.datasetRepository = options.datasetRepository;
    this.datasetVersionRepository = options.datasetVersionRepository;
    this.factory = options.factory ?? new TuningDatasetFactory();
    this.validationService = options.validationService;
    this.splitService = options.splitService;
    this.exportService = options.exportService;
    this.importService = options.importService;
    this.generationService = options.generationService;
    this.reviewPolicy = options.reviewPolicy;
    this.duplicationPolicy = options.duplicationPolicy;
    this.statisticsService = options.statisticsService;
    this.lineageService = options.lineageService ?? new DatasetLineageService();
    this.releaseManifestService = options.releaseManifestService ?? new ReleaseManifestService();
    this.createId = options.createId ?? defaultCreateId;
  }

  public async createDataset(command: CreateDatasetCommand): Promise<DatasetDetails> {
    const dataset = this.factory.createDataset({
      id: command.id?.trim() || this.createId("dataset"),
      name: command.name,
      description: command.description,
      taskType: command.taskType,
      tags: command.tags,
      createdBy: command.createdBy,
      createdAt: new Date(),
    }) as TuningDataset;
    const savedDataset = await this.datasetRepository.save(dataset);

    let version: DatasetVersion | undefined;
    if (command.initializeVersion ?? true) {
      version = await this.createDatasetVersion({ datasetId: savedDataset.id, createdBy: command.createdBy });
    }

    return this.getDatasetDetails({ datasetId: savedDataset.id });
  }

  public async createDatasetVersion(command: CreateDatasetVersionCommand): Promise<DatasetVersion> {
    const dataset = await this.requireDataset(command.datasetId);
    const versions = await this.datasetVersionRepository.listVersions(dataset.id);
    const version = this.factory.createVersion({
      id: this.createId("dataset_version"),
      datasetId: dataset.id,
      taskType: dataset.taskType,
      versionNumber: versions.length + 1,
      createdBy: command.createdBy,
      createdAt: new Date(),
    }) as TuningDatasetVersion;
    const savedVersion = await this.datasetVersionRepository.saveVersion(version);
    await this.datasetRepository.save((dataset as TuningDataset).withLatestVersion(savedVersion as TuningDatasetVersion));
    return savedVersion;
  }

  public async releaseDatasetVersion(command: ReleaseDatasetVersionCommand): Promise<DatasetVersion> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: dataset.id, versionId: version.id });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(dataset.id, version.id);
    const validation = await this.validateDatasetVersion({ datasetId: dataset.id, versionId: version.id });
    const statistics = await this.computeDatasetStatistics(dataset.id, version.id);
    const releasedVersion = (version as TuningDatasetVersion).release(command.releaseNotes, validation, statistics);
    const savedVersion = await this.datasetVersionRepository.saveVersion(releasedVersion);
    await this.datasetRepository.save((dataset as TuningDataset).withLatestVersion(savedVersion as TuningDatasetVersion));
    const manifest = this.releaseManifestService.create({ dataset, version: savedVersion, examples, sourceDocumentCount: sourceDocuments.length });
    const canonicalJson = this.exportService.exportVersion({ dataset, version: savedVersion, examples, sourceDocuments, format: "canonical_json", manifest });
    await this.datasetVersionRepository.saveExportArtifact(canonicalJson);
    return savedVersion;
  }

  public async archiveDataset(command: ArchiveDatasetCommand): Promise<DatasetDetails> {
    const dataset = await this.requireDataset(command.datasetId);
    await this.datasetRepository.save((dataset as TuningDataset).archive());
    return this.getDatasetDetails({ datasetId: dataset.id });
  }

  public async listDatasets(query: ListDatasetsQuery = {}): Promise<ReadonlyArray<DatasetSummary>> {
    const datasets = await this.datasetRepository.list(query);
    return Object.freeze(await Promise.all(datasets.map(async (dataset) => {
      const versions = await this.datasetVersionRepository.listVersions(dataset.id);
      const latestVersion = dataset.latestVersionId
        ? versions.find((version) => version.id === dataset.latestVersionId)
        : versions[versions.length - 1];
      const statistics = latestVersion ? await this.computeDatasetStatistics(dataset.id, latestVersion.id).catch(() => undefined) : undefined;
      return Object.freeze({
        dataset,
        latestVersion,
        statistics,
        exampleCount: statistics?.exampleCount ?? 0,
      });
    })));
  }

  public async getDatasetDetails(query: GetDatasetDetailsQuery): Promise<DatasetDetails> {
    const dataset = await this.requireDataset(query.datasetId);
    const versions = await this.datasetVersionRepository.listVersions(dataset.id);
    const latestVersion = dataset.latestVersionId
      ? versions.find((version) => version.id === dataset.latestVersionId)
      : versions[versions.length - 1];
    const sourceDocuments = latestVersion
      ? await this.datasetVersionRepository.listSourceDocuments(dataset.id, latestVersion.id)
      : [];
    const validation = latestVersion
      ? await this.datasetVersionRepository.loadValidationResult(dataset.id, latestVersion.id)
      : undefined;
    const statistics = latestVersion
      ? await this.computeDatasetStatistics(dataset.id, latestVersion.id).catch(() => undefined)
      : undefined;
    const exports = latestVersion
      ? await this.datasetVersionRepository.listExportArtifacts(dataset.id, latestVersion.id)
      : [];

    return Object.freeze({
      dataset,
      versions,
      latestVersion,
      sourceDocuments,
      statistics,
      validation,
      exports,
    });
  }

  public async addExample(command: AddExampleCommand): Promise<QuestionAnsweringExample> {
    const version = await this.requireVersion(command.datasetId, command.versionId);
    (version as TuningDatasetVersion).assertMutable();
    const example = new QuestionAnsweringExample({
      id: this.createId("qa_example"),
      datasetId: command.datasetId,
      versionId: command.versionId,
      question: command.question,
      answer: command.answer,
      context: command.context,
      sourceDocumentId: command.sourceDocumentId,
      split: command.split,
      status: command.status,
      tags: command.tags,
      createdBy: command.createdBy,
      lineage: command.sourceDocumentId
        ? this.lineageService.captureFromSource(command.sourceDocumentId)
        : new ExampleLineage({ generationMethod: "manual-authoring" }),
    });
    return this.datasetVersionRepository.saveExample(example) as Promise<QuestionAnsweringExample>;
  }

  public async updateExample(command: UpdateExampleCommand): Promise<QuestionAnsweringExample> {
    const current = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const annotations = command.annotationNote
      ? [...current.annotations, createReviewAnnotation(command.updatedBy, command.annotationNote)]
      : current.annotations;
    const updated = current.withContent({
      question: command.question,
      answer: command.answer,
      context: command.context,
      split: command.split,
      status: command.status,
      tags: command.tags,
      annotations,
    });
    return this.datasetVersionRepository.saveExample(updated) as Promise<QuestionAnsweringExample>;
  }

  public async deleteExample(command: DeleteExampleCommand): Promise<void> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    await this.datasetVersionRepository.deleteExample(command.datasetId, command.versionId, command.exampleId);
  }

  public async bulkAddExamples(command: BulkAddExamplesCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    return Object.freeze(await Promise.all(command.examples.map((example) => this.addExample({ ...example, datasetId: command.datasetId, versionId: command.versionId, createdBy: command.createdBy }))));
  }

  public async bulkUpdateExampleStatus(command: BulkUpdateExampleStatusCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    return Object.freeze(await Promise.all(command.exampleIds.map((exampleId) => this.reviewExample({
      datasetId: command.datasetId,
      versionId: command.versionId,
      exampleId,
      status: command.status,
      reviewer: command.updatedBy,
      note: command.annotationNote,
    }))));
  }

  public async listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    const examples = await this.datasetVersionRepository.listExamples(query);
    return Object.freeze(examples.map((example) => example as QuestionAnsweringExample));
  }

  public async getExampleDetails(query: GetExampleDetailsQuery): Promise<QuestionAnsweringExample | undefined> {
    return this.datasetVersionRepository.loadExample(query.datasetId, query.versionId, query.exampleId) as Promise<QuestionAnsweringExample | undefined>;
  }

  public async importSourceDocuments(command: ImportSourceDocumentsCommand) {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const imported = this.importService.importSourceDocuments({
      datasetId: command.datasetId,
      versionId: command.versionId,
      createdBy: command.createdBy,
      documents: command.documents.map((document) => ({
        id: document.id?.trim() || this.createId("source_doc"),
        name: document.name,
        content: document.content,
        metadata: document.metadata,
      })),
    });
    await Promise.all(imported.map((document) => this.datasetVersionRepository.saveSourceDocument(document)));
    return imported;
  }

  public async generateQaExamplesFromSource(command: GenerateQaExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    await this.ensureQuestionAnsweringDataset(command.datasetId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, command.versionId);
    const selectedDocuments = sourceDocuments.filter((document) => command.sourceDocumentIds.includes(document.id));
    if (selectedDocuments.length === 0) {
      throw new Error("Select at least one source document for QA generation.");
    }
    const existingExamples = await this.datasetVersionRepository.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const generated = this.generationService.generateQuestionAnsweringExamples({
      datasetId: command.datasetId,
      versionId: command.versionId,
      createdBy: command.createdBy,
      sourceDocuments: selectedDocuments,
      existingExamples,
    }).map((example) => example as QuestionAnsweringExample);
    await Promise.all(generated.map((example) => this.datasetVersionRepository.saveExample(example)));
    return Object.freeze(generated);
  }

  public async regenerateQaExample(command: RegenerateQaExampleCommand): Promise<QuestionAnsweringExample> {
    const existing = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    if (!existing.sourceDocumentId) {
      throw new Error("Only source-linked examples can be regenerated.");
    }
    const [regenerated] = await this.generateQaExamplesFromSource({
      datasetId: command.datasetId,
      versionId: command.versionId,
      createdBy: command.updatedBy,
      sourceDocumentIds: [existing.sourceDocumentId],
    });
    return regenerated ?? existing;
  }

  public async transformSourceToQaExamples(command: GenerateQaExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    return this.generateQaExamplesFromSource(command);
  }

  public async validateDatasetVersion(command: ValidateDatasetVersionCommand): Promise<DatasetValidationResult> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const validationResult = this.validationService.validateVersion({ dataset, version, examples });
    const issuesByExampleId = new Map<string, typeof validationResult.issues>();
    for (const issue of validationResult.issues) {
      if (!issue.exampleId) {
        continue;
      }
      issuesByExampleId.set(issue.exampleId, [...(issuesByExampleId.get(issue.exampleId) ?? []), issue]);
    }
    await Promise.all(examples.map((example) => this.datasetVersionRepository.saveExample(example.withContent({ validationIssues: issuesByExampleId.get(example.id) ?? [] }))));
    const statistics = await this.computeDatasetStatistics(command.datasetId, command.versionId);
    const nextVersion = (version as TuningDatasetVersion).withValidation(validationResult, statistics);
    await this.datasetVersionRepository.saveVersion(nextVersion);
    await this.datasetVersionRepository.saveValidationResult(validationResult);
    await this.datasetRepository.save((dataset as TuningDataset).withLatestVersion(nextVersion));
    return validationResult;
  }

  public async reviewExample(command: ReviewExampleCommand): Promise<QuestionAnsweringExample> {
    if (!this.reviewPolicy.canTransition("draft", command.status) && !["accepted", "rejected", "needs_review", "draft"].includes(command.status)) {
      throw new Error(`Unsupported example review status '${command.status}'.`);
    }
    const current = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    if (!this.reviewPolicy.canTransition(current.status, command.status)) {
      throw new Error(`Illegal example status transition: ${current.status} -> ${command.status}.`);
    }
    const updated = current.withStatus(command.status, command.note ? createReviewAnnotation(command.reviewer, command.note) : undefined);
    return this.datasetVersionRepository.saveExample(updated) as Promise<QuestionAnsweringExample>;
  }

  public async acceptExample(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample> {
    return this.reviewExample({ ...command, status: "accepted" });
  }

  public async rejectExample(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample> {
    return this.reviewExample({ ...command, status: "rejected" });
  }

  public async markExampleNeedsReview(command: Omit<ReviewExampleCommand, "status">): Promise<QuestionAnsweringExample> {
    return this.reviewExample({ ...command, status: "needs_review" });
  }

  public async detectDuplicates(datasetId: string, versionId: string) {
    const examples = await this.listExamples({ datasetId, versionId });
    return this.duplicationPolicy.detectDuplicates(examples);
  }

  public async computeDatasetStatistics(datasetId: string, versionId: string): Promise<DatasetStatistics> {
    const examples = await this.listExamples({ datasetId, versionId }).catch(() => []);
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(datasetId, versionId).catch(() => []);
    return this.statisticsService.compute(datasetId, versionId, examples, sourceDocuments.length);
  }

  public async assignSplitsAutomatically(command: AssignSplitsAutomaticallyCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const assigned = this.splitService.assign(examples, command.actor).map((example) => example as QuestionAnsweringExample);
    await Promise.all(assigned.map((example) => this.datasetVersionRepository.saveExample(example)));
    return Object.freeze(assigned);
  }

  public async updateSplitAssignment(command: UpdateSplitAssignmentCommand): Promise<QuestionAnsweringExample> {
    const example = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const updated = example.withContent({ split: command.split, annotations: [...example.annotations, createReviewAnnotation(command.actor, `Split changed to ${command.split}`)] });
    return this.datasetVersionRepository.saveExample(updated) as Promise<QuestionAnsweringExample>;
  }

  public async exportDatasetVersion(command: ExportDatasetVersionCommand): Promise<DatasetExportArtifact> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    if (version.status !== "released") {
      throw new Error("Only released dataset versions can be exported.");
    }
    if (!["canonical_json", "canonical_jsonl", "qa_jsonl"].includes(command.format)) {
      throw new Error(`Export format '${command.format}' is modeled but not implemented in this release.`);
    }
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, command.versionId);
    const manifest = this.releaseManifestService.create({ dataset, version, examples, sourceDocumentCount: sourceDocuments.length });
    const artifact = this.exportService.exportVersion({ dataset, version, examples, sourceDocuments, format: command.format as ExportFormat, manifest });
    return this.datasetVersionRepository.saveExportArtifact(artifact);
  }

  public async listExports(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>> {
    return this.datasetVersionRepository.listExportArtifacts(datasetId, versionId);
  }

  private async ensureVersionMutable(datasetId: string, versionId: string): Promise<void> {
    const version = await this.requireVersion(datasetId, versionId);
    (version as TuningDatasetVersion).assertMutable();
  }

  private async ensureQuestionAnsweringDataset(datasetId: string): Promise<void> {
    const dataset = await this.requireDataset(datasetId);
    if (dataset.taskType !== "question_answering") {
      throw new Error(`Dataset task type '${dataset.taskType}' is not fully supported in this release.`);
    }
  }

  private async requireDataset(datasetId: string): Promise<Dataset> {
    const dataset = await this.datasetRepository.load(datasetId.trim());
    if (!dataset) {
      throw new Error(`Dataset '${datasetId}' was not found.`);
    }
    return dataset;
  }

  private async requireVersion(datasetId: string, versionId: string): Promise<DatasetVersion> {
    const version = await this.datasetVersionRepository.loadVersion(datasetId.trim(), versionId.trim());
    if (!version) {
      throw new Error(`Dataset version '${versionId}' was not found.`);
    }
    return version;
  }

  private async requireExample(datasetId: string, versionId: string, exampleId: string): Promise<QuestionAnsweringExample> {
    const example = await this.datasetVersionRepository.loadExample(datasetId.trim(), versionId.trim(), exampleId.trim());
    if (!example) {
      throw new Error(`Dataset example '${exampleId}' was not found.`);
    }
    return example as QuestionAnsweringExample;
  }
}

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
