import {
  ChatCompletionExample,
  ExampleLineage,
  QuestionAnsweringExample,
  TuningDataset,
  TuningDatasetVersion,
  type SourceDocumentReference,
} from "../../domain/tuning-datasets/TuningDatasetEntities";
import {
  DatasetLineageService,
  DatasetStatisticsService,
  ReleaseManifestService,
  TuningDatasetFactory,
  createReviewAnnotation,
} from "../../domain/tuning-datasets/TuningDatasetServices";
import type {
  Dataset,
  DatasetDuplicationPolicy,
  DatasetExample,
  DatasetExportArtifact,
  DatasetExportService,
  DatasetGenerationService,
  DatasetImportService,
  DatasetReleasePolicy,
  DatasetRepository,
  DatasetReviewPolicy,
  DatasetSourceDocument,
  DatasetSplitService,
  DatasetStatistics,
  DatasetValidationResult,
  DatasetValidationService,
  DatasetVersion,
  DatasetVersionRepository,
  DatasetWorkflowService,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  AddExampleCommand,
  ArchiveDatasetCommand,
  AssignSplitsAutomaticallyCommand,
  BulkUpdateExamplesCommand,
  CreateDatasetCommand,
  CreateDatasetVersionCommand,
  CreateSuccessorDatasetVersionCommand,
  DatasetDetails,
  DatasetSummary,
  DeleteExampleCommand,
  ExportDatasetVersionCommand,
  GenerateExamplesFromSourceCommand,
  GetDatasetDetailsQuery,
  GetExampleDetailsQuery,
  ImportSourceDocumentsCommand,
  ListDatasetsQuery,
  ListExamplesQuery,
  MoveWorkflowStageCommand,
  ReleaseDatasetVersionCommand,
  ReviewExampleCommand,
  SelectDatasetVersionCommand,
  StudioExample,
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
  readonly releasePolicy: DatasetReleasePolicy;
  readonly workflowService: DatasetWorkflowService;
  readonly lineageService?: DatasetLineageService;
  readonly releaseManifestService?: ReleaseManifestService;
  readonly createId?: (prefix: string) => string;
}

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  private readonly releasePolicy: DatasetReleasePolicy;
  private readonly workflowService: DatasetWorkflowService;
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
    this.releasePolicy = options.releasePolicy;
    this.workflowService = options.workflowService;
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

    if (command.initializeVersion ?? true) {
      await this.createDatasetVersion({ datasetId: savedDataset.id, createdBy: command.createdBy });
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
      kind: versions.length === 0 ? "initial_draft" : "branch_draft",
    }) as TuningDatasetVersion;
    const savedVersion = await this.datasetVersionRepository.saveVersion(version);
    await this.datasetVersionRepository.saveWorkflowState(this.workflowService.createInitial(dataset.id, savedVersion.id));
    await this.datasetRepository.save((dataset as TuningDataset).withVersionPointers(savedVersion as TuningDatasetVersion));
    await this.reconcileWorkflow(dataset.id, savedVersion.id);
    return savedVersion;
  }

  public async createSuccessorDatasetVersion(command: CreateSuccessorDatasetVersionCommand): Promise<DatasetDetails> {
    const dataset = await this.requireDataset(command.datasetId);
    const releasedVersion = await this.requireVersion(command.datasetId, command.releasedVersionId);
    if (releasedVersion.status !== "released") {
      throw new Error("Only released versions can create successor drafts.");
    }
    const versions = await this.datasetVersionRepository.listVersions(command.datasetId);
    const successor = (releasedVersion as TuningDatasetVersion).createDraftSuccessor({
      id: this.createId("dataset_version"),
      versionNumber: versions.length + 1,
      createdBy: command.createdBy,
    });
    await this.datasetVersionRepository.saveVersion(successor);
    if (command.cloneSources ?? true) {
      const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, releasedVersion.id);
      await Promise.all(sourceDocuments.map((document) => this.datasetVersionRepository.saveSourceDocument({
        ...document,
        id: this.createId("source_doc"),
        versionId: successor.id,
        createdBy: command.createdBy,
        createdAt: new Date(),
        segments: document.segments.map((segment) => ({ ...segment })),
      })));
    }
    if (command.cloneExamples ?? true) {
      const examples = await this.datasetVersionRepository.listExamples({ datasetId: command.datasetId, versionId: releasedVersion.id });
      await Promise.all(examples.map((example) => this.datasetVersionRepository.saveExample(this.cloneExampleForVersion(example, successor.id, command.createdBy))));
    }
    await this.datasetVersionRepository.saveWorkflowState(this.workflowService.createInitial(dataset.id, successor.id));
    await this.datasetRepository.save((dataset as TuningDataset).withVersionPointers(successor));
    await this.reconcileWorkflow(dataset.id, successor.id);
    return this.getDatasetDetails({ datasetId: dataset.id, versionId: successor.id });
  }

  public async selectDatasetVersion(command: SelectDatasetVersionCommand): Promise<DatasetDetails> {
    const dataset = await this.requireDataset(command.datasetId);
    await this.requireVersion(command.datasetId, command.versionId);
    await this.datasetRepository.save((dataset as TuningDataset).selectVersion(command.versionId));
    return this.getDatasetDetails({ datasetId: command.datasetId, versionId: command.versionId });
  }

  public async releaseDatasetVersion(command: ReleaseDatasetVersionCommand): Promise<DatasetVersion> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: dataset.id, versionId: version.id });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(dataset.id, version.id);
    const validation = await this.validateDatasetVersion({ datasetId: dataset.id, versionId: version.id });
    const statistics = await this.computeDatasetStatistics(dataset.id, version.id);
    const readiness = this.releasePolicy.evaluate({ dataset, version, examples, validation });
    if (!readiness.isReady) {
      throw new Error(`Release blocked: ${readiness.blockingReasons.join(" ")}`);
    }
    const releasedVersion = (version as TuningDatasetVersion).release({ releaseNotes: command.releaseNotes, validationResult: validation, statistics });
    const savedVersion = await this.datasetVersionRepository.saveVersion(releasedVersion);
    await this.datasetRepository.save((dataset as TuningDataset).withVersionPointers(savedVersion as TuningDatasetVersion, savedVersion.id));
    const manifest = this.releaseManifestService.create({ dataset, version: savedVersion, examples, sourceDocumentCount: sourceDocuments.length });
    const canonicalJson = this.exportService.exportVersion({ dataset, version: savedVersion, examples, sourceDocuments, format: "canonical_json", manifest });
    await this.datasetVersionRepository.saveExportArtifact(canonicalJson);
    await this.reconcileWorkflow(dataset.id, savedVersion.id);
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
      const latestVersion = dataset.latestVersionId ? versions.find((version) => version.id === dataset.latestVersionId) : versions[versions.length - 1];
      const selectedVersion = dataset.selectedVersionId ? versions.find((version) => version.id === dataset.selectedVersionId) ?? latestVersion : latestVersion;
      const statistics = selectedVersion ? await this.computeDatasetStatistics(dataset.id, selectedVersion.id).catch(() => undefined) : undefined;
      return Object.freeze({
        dataset,
        latestVersion,
        selectedVersion,
        statistics,
        exampleCount: statistics?.exampleCount ?? 0,
      });
    })));
  }

  public async getDatasetDetails(query: GetDatasetDetailsQuery): Promise<DatasetDetails> {
    const dataset = await this.requireDataset(query.datasetId);
    const versions = await this.datasetVersionRepository.listVersions(dataset.id);
    const latestVersion = dataset.latestVersionId ? versions.find((version) => version.id === dataset.latestVersionId) : versions[versions.length - 1];
    const selectedVersion = query.versionId
      ? versions.find((version) => version.id === query.versionId)
      : dataset.selectedVersionId
        ? versions.find((version) => version.id === dataset.selectedVersionId)
        : latestVersion;
    const sourceDocuments = selectedVersion ? await this.datasetVersionRepository.listSourceDocuments(dataset.id, selectedVersion.id) : [];
    const validation = selectedVersion ? await this.datasetVersionRepository.loadValidationResult(dataset.id, selectedVersion.id) : undefined;
    const statistics = selectedVersion ? await this.computeDatasetStatistics(dataset.id, selectedVersion.id).catch(() => undefined) : undefined;
    const exports = selectedVersion ? await this.datasetVersionRepository.listExportArtifacts(dataset.id, selectedVersion.id) : [];
    const workflow = selectedVersion
      ? await this.loadWorkflow(dataset.id, selectedVersion.id)
      : this.workflowService.createInitial(dataset.id, "uninitialized");

    return Object.freeze({
      dataset,
      versions,
      latestVersion,
      selectedVersion,
      sourceDocuments,
      statistics,
      validation,
      exports,
      workflow,
    });
  }

  public async addExample(command: AddExampleCommand): Promise<StudioExample> {
    const dataset = await this.requireDataset(command.datasetId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const example = command.taskType === "question_answering"
      ? new QuestionAnsweringExample({
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
          lineage: command.sourceDocumentId ? this.lineageService.captureFromSource(command.sourceDocumentId) : new ExampleLineage({ generationMethod: "manual-authoring" }),
        })
      : new ChatCompletionExample({
          id: this.createId("chat_example"),
          datasetId: command.datasetId,
          versionId: command.versionId,
          messages: command.messages,
          split: command.split,
          status: command.status,
          tags: command.tags,
          createdBy: command.createdBy,
          lineage: new ExampleLineage({ generationMethod: "manual-authoring" }),
        });
    const saved = await this.datasetVersionRepository.saveExample(example);
    await this.reconcileWorkflow(dataset.id, command.versionId);
    return saved;
  }

  public async updateExample(command: UpdateExampleCommand): Promise<StudioExample> {
    const current = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const annotations = command.annotationNote ? [...current.annotations, createReviewAnnotation(command.updatedBy, command.annotationNote)] : current.annotations;
    const updated = current instanceof QuestionAnsweringExample
      ? current.withContent({
          question: "question" in command ? command.question : undefined,
          answer: "answer" in command ? command.answer : undefined,
          context: "context" in command ? command.context : undefined,
          split: command.split,
          status: command.status,
          tags: command.tags,
          annotations,
        })
      : (current as ChatCompletionExample).withContent({
          messages: "messages" in command ? command.messages : undefined,
          split: command.split,
          status: command.status,
          tags: command.tags,
          annotations,
        });
    const saved = await this.datasetVersionRepository.saveExample(updated);
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return saved;
  }

  public async deleteExample(command: DeleteExampleCommand): Promise<void> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    await this.datasetVersionRepository.deleteExample(command.datasetId, command.versionId, command.exampleId);
    await this.reconcileWorkflow(command.datasetId, command.versionId);
  }

  public async bulkUpdateExamples(command: BulkUpdateExamplesCommand): Promise<ReadonlyArray<StudioExample>> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const updated = await Promise.all(command.exampleIds.map(async (exampleId) => {
      const example = await this.requireExample(command.datasetId, command.versionId, exampleId);
      const annotations = command.annotationNote ? [...example.annotations, createReviewAnnotation(command.updatedBy, command.annotationNote)] : example.annotations;
      const next = example instanceof QuestionAnsweringExample
        ? example.withContent({ status: command.status, split: command.split, annotations })
        : (example as ChatCompletionExample).withContent({ status: command.status, split: command.split, annotations });
      return this.datasetVersionRepository.saveExample(next);
    }));
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return Object.freeze(updated);
  }

  public async listExamples(query: ListExamplesQuery): Promise<ReadonlyArray<StudioExample>> {
    return this.datasetVersionRepository.listExamples(query);
  }

  public async getExampleDetails(query: GetExampleDetailsQuery): Promise<StudioExample | undefined> {
    return this.datasetVersionRepository.loadExample(query.datasetId, query.versionId, query.exampleId);
  }

  public async importSourceDocuments(command: ImportSourceDocumentsCommand): Promise<ReadonlyArray<DatasetSourceDocument>> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const imported = this.importService.importSourceDocuments({
      datasetId: command.datasetId,
      versionId: command.versionId,
      createdBy: command.createdBy,
      documents: command.documents,
    });
    await Promise.all(imported.documents.map((document) => this.datasetVersionRepository.saveSourceDocument(document)));
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return imported.documents;
  }

  public async generateExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<StudioExample>> {
    const dataset = await this.requireDataset(command.datasetId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, command.versionId);
    const selectedDocuments = sourceDocuments.filter((document) => command.sourceDocumentIds.includes(document.id));
    if (selectedDocuments.length === 0) {
      throw new Error("Select at least one source document for generation.");
    }
    const existingExamples = await this.datasetVersionRepository.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const generated = this.generationService.generate({
      datasetId: command.datasetId,
      versionId: command.versionId,
      taskType: dataset.taskType,
      createdBy: command.createdBy,
      sourceDocuments: selectedDocuments,
      existingExamples,
      configuration: command.configuration,
    });
    const enrichedExamples = generated.examples.map((example) => this.attachGenerationProvenance(example, generated.provenance));
    await Promise.all(enrichedExamples.map((example) => this.datasetVersionRepository.saveExample(example)));
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return Object.freeze(enrichedExamples);
  }

  public async generateQaExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<QuestionAnsweringExample>> {
    const dataset = await this.requireDataset(command.datasetId);
    if (dataset.taskType !== "question_answering") {
      throw new Error("QA generation requires a question_answering dataset.");
    }
    return (await this.generateExamplesFromSource(command)).map((example) => example as QuestionAnsweringExample);
  }

  public async generateChatExamplesFromSource(command: GenerateExamplesFromSourceCommand): Promise<ReadonlyArray<ChatCompletionExample>> {
    const dataset = await this.requireDataset(command.datasetId);
    if (dataset.taskType !== "chat_completion") {
      throw new Error("Chat generation requires a chat_completion dataset.");
    }
    return (await this.generateExamplesFromSource(command)).map((example) => example as ChatCompletionExample);
  }

  public async validateDatasetVersion(command: ValidateDatasetVersionCommand): Promise<DatasetValidationResult> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, command.versionId);
    const statistics = this.statisticsService.compute(command.datasetId, command.versionId, examples, sourceDocuments.length);
    const validation = this.validationService.validateVersion({ dataset, version, examples, sourceDocuments });
    await this.datasetVersionRepository.saveValidationResult(validation);
    await this.datasetVersionRepository.saveVersion((version as TuningDatasetVersion).withValidation(validation, statistics));
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return validation;
  }

  public async reviewExample(command: ReviewExampleCommand): Promise<StudioExample> {
    const example = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    if (!this.reviewPolicy.canTransition(example.status, command.status)) {
      throw new Error(`Example review transition '${example.status}' -> '${command.status}' is not allowed.`);
    }
    const annotation = command.note ? createReviewAnnotation(command.reviewer, command.note) : undefined;
    const updated = example instanceof QuestionAnsweringExample
      ? example.withStatus(command.status, annotation)
      : (example as ChatCompletionExample).withStatus(command.status, annotation);
    const saved = await this.datasetVersionRepository.saveExample(updated);
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return saved;
  }

  public acceptExample(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample> {
    return this.reviewExample({ ...command, status: "accepted" });
  }

  public rejectExample(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample> {
    return this.reviewExample({ ...command, status: "rejected" });
  }

  public markExampleNeedsReview(command: Omit<ReviewExampleCommand, "status">): Promise<StudioExample> {
    return this.reviewExample({ ...command, status: "needs_review" });
  }

  public async detectDuplicates(datasetId: string, versionId: string): Promise<ReadonlyArray<{ fingerprint: string; exampleIds: ReadonlyArray<string> }>> {
    const examples = await this.listExamples({ datasetId, versionId });
    return this.duplicationPolicy.detectDuplicates(examples);
  }

  public async computeDatasetStatistics(datasetId: string, versionId: string): Promise<DatasetStatistics> {
    const examples = await this.listExamples({ datasetId, versionId });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(datasetId, versionId);
    return this.statisticsService.compute(datasetId, versionId, examples, sourceDocuments.length);
  }

  public async assignSplitsAutomatically(command: AssignSplitsAutomaticallyCommand): Promise<ReadonlyArray<StudioExample>> {
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const assigned = this.splitService.assign(examples, command.actor);
    await Promise.all(assigned.map((example) => this.datasetVersionRepository.saveExample(example)));
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return assigned;
  }

  public async updateSplitAssignment(command: UpdateSplitAssignmentCommand): Promise<StudioExample> {
    const example = await this.requireExample(command.datasetId, command.versionId, command.exampleId);
    await this.ensureVersionMutable(command.datasetId, command.versionId);
    const updated = example instanceof QuestionAnsweringExample
      ? example.withContent({ split: command.split, annotations: [...example.annotations, createReviewAnnotation(command.actor, `Changed split to ${command.split}`)] })
      : (example as ChatCompletionExample).withContent({ split: command.split, annotations: [...example.annotations, createReviewAnnotation(command.actor, `Changed split to ${command.split}`)] });
    const saved = await this.datasetVersionRepository.saveExample(updated);
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return saved;
  }

  public async loadWorkflow(datasetId: string, versionId: string) {
    const workflow = await this.datasetVersionRepository.loadWorkflowState(datasetId, versionId);
    if (workflow) {
      return workflow;
    }
    const initialized = this.workflowService.createInitial(datasetId, versionId);
    await this.datasetVersionRepository.saveWorkflowState(initialized);
    return initialized;
  }

  public async moveWorkflowStage(command: MoveWorkflowStageCommand) {
    const current = await this.loadWorkflow(command.datasetId, command.versionId);
    const next = this.workflowService.transition(current, command.stage);
    await this.datasetVersionRepository.saveWorkflowState(next);
    return next;
  }

  public async exportDatasetVersion(command: ExportDatasetVersionCommand): Promise<DatasetExportArtifact> {
    const dataset = await this.requireDataset(command.datasetId);
    const version = await this.requireVersion(command.datasetId, command.versionId);
    const examples = await this.listExamples({ datasetId: command.datasetId, versionId: command.versionId });
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(command.datasetId, command.versionId);
    const manifest = this.releaseManifestService.create({ dataset, version, examples, sourceDocumentCount: sourceDocuments.length });
    const artifact = this.exportService.exportVersion({
      dataset,
      version,
      examples,
      sourceDocuments,
      format: command.format,
      manifest,
    });
    const saved = await this.datasetVersionRepository.saveExportArtifact(artifact);
    await this.reconcileWorkflow(command.datasetId, command.versionId);
    return saved;
  }

  public listExports(datasetId: string, versionId: string): Promise<ReadonlyArray<DatasetExportArtifact>> {
    return this.datasetVersionRepository.listExportArtifacts(datasetId, versionId);
  }

  private async requireDataset(datasetId: string): Promise<Dataset> {
    const dataset = await this.datasetRepository.load(datasetId);
    if (!dataset) {
      throw new Error(`Dataset '${datasetId}' was not found.`);
    }
    return dataset;
  }

  private async requireVersion(datasetId: string, versionId: string): Promise<DatasetVersion> {
    const version = await this.datasetVersionRepository.loadVersion(datasetId, versionId);
    if (!version) {
      throw new Error(`Dataset version '${versionId}' was not found for dataset '${datasetId}'.`);
    }
    return version;
  }

  private async requireExample(datasetId: string, versionId: string, exampleId: string): Promise<StudioExample> {
    const example = await this.datasetVersionRepository.loadExample(datasetId, versionId, exampleId);
    if (!example) {
      throw new Error(`Example '${exampleId}' was not found in dataset version '${versionId}'.`);
    }
    return example;
  }

  private async ensureVersionMutable(datasetId: string, versionId: string): Promise<void> {
    (await this.requireVersion(datasetId, versionId) as TuningDatasetVersion).assertMutable();
  }

  private cloneExampleForVersion(example: DatasetExample, versionId: string, createdBy: string): DatasetExample {
    if (example instanceof QuestionAnsweringExample) {
      return new QuestionAnsweringExample({
        id: this.createId("qa_example"),
        datasetId: example.datasetId,
        versionId,
        question: example.question,
        answer: example.answer,
        context: example.context,
        sourceDocumentId: example.sourceDocumentId,
        sourceOffsets: example.sourceOffsets,
        sourceMetadata: example.sourceMetadata,
        split: example.split,
        status: "draft",
        tags: example.tags,
        createdBy,
        lineage: new ExampleLineage({
          sourceDocumentId: example.sourceDocumentId,
          generatedFromExampleId: example.id,
          generationMethod: "version-clone",
        }),
      });
    }

    const chatExample = example as ChatCompletionExample;
    return new ChatCompletionExample({
      id: this.createId("chat_example"),
      datasetId: example.datasetId,
      versionId,
      messages: chatExample.messages,
      split: example.split,
      status: "draft",
      tags: example.tags,
      createdBy,
      lineage: new ExampleLineage({
        sourceDocumentId: example.lineage.sourceDocumentId,
        generatedFromExampleId: example.id,
        generationMethod: "version-clone",
      }),
    });
  }

  private attachGenerationProvenance(example: DatasetExample, provenance: NonNullable<DatasetExample["lineage"]["generator"]>): DatasetExample {
    if (example instanceof QuestionAnsweringExample) {
      return new QuestionAnsweringExample({
        ...example,
        lineage: new ExampleLineage({ ...example.lineage, generator: provenance }),
      });
    }
    return new ChatCompletionExample({
      ...(example as ChatCompletionExample),
      messages: (example as ChatCompletionExample).messages,
      lineage: new ExampleLineage({ ...example.lineage, generator: provenance }),
    });
  }

  private async reconcileWorkflow(datasetId: string, versionId: string): Promise<void> {
    const dataset = await this.requireDataset(datasetId);
    const version = await this.requireVersion(datasetId, versionId);
    const sourceDocuments = await this.datasetVersionRepository.listSourceDocuments(datasetId, versionId);
    const examples = await this.datasetVersionRepository.listExamples({ datasetId, versionId });
    const validation = await this.datasetVersionRepository.loadValidationResult(datasetId, versionId);
    const exports = await this.datasetVersionRepository.listExportArtifacts(datasetId, versionId);
    const current = await this.datasetVersionRepository.loadWorkflowState(datasetId, versionId);
    const workflow = this.workflowService.reconcile({
      datasetId,
      versionId,
      current,
      hasDefinition: Boolean(dataset.name.trim()),
      sourceCount: sourceDocuments.length,
      exampleCount: examples.length,
      validation,
      version,
      exportCount: exports.length,
    });
    await this.datasetVersionRepository.saveWorkflowState(workflow);
  }
}
