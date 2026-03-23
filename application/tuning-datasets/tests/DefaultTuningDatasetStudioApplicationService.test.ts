import { describe, expect, it } from "bun:test";
import { DefaultFileIngestionApplicationService } from "../../ingestion/DefaultFileIngestionApplicationService";
import { DefaultTuningDatasetStudioApplicationService } from "../DefaultTuningDatasetStudioApplicationService";
import { BrowserDatasetImportService, DatasetStatisticsService, DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReleasePolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, JsonTuningDatasetExportService, ProviderAgnosticDatasetGenerationService, TaskTypeAwareValidationService } from "../../../domain/tuning-datasets/TuningDatasetServices";
import { FileIngestionPolicyService } from "../../../domain/ingestion/FileIngestionServices";
import { LocalStorageTuningDatasetRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";
import { UnifiedExecutionEngine } from "../../execution/UnifiedExecutionEngine";
import { DatasetGenerationExecutionUnitHandler } from "../../../infrastructure/execution/DatasetGenerationExecutionUnitHandler";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function createService(options: { generationService?: any; executionEngine?: UnifiedExecutionEngine } = {}) {
  const storage = new MemoryStorage();
  const datasetRepository = new LocalStorageTuningDatasetRepository("test-datasets", storage as never);
  const versionRepository = new LocalStorageTuningDatasetVersionRepository(storage as never);
  const duplicationPolicy = new DefaultDatasetDuplicationPolicy();

  return new DefaultTuningDatasetStudioApplicationService({
    datasetRepository,
    datasetVersionRepository: versionRepository,
    validationService: new TaskTypeAwareValidationService(duplicationPolicy),
    splitService: new DeterministicDatasetSplitService(),
    exportService: new JsonTuningDatasetExportService(),
    importService: new BrowserDatasetImportService(new DefaultDatasetPrivacyPolicy()),
    generationService: options.generationService ?? new ProviderAgnosticDatasetGenerationService(),
    reviewPolicy: new DefaultDatasetReviewPolicy(),
    duplicationPolicy,
    statisticsService: new DatasetStatisticsService(duplicationPolicy),
    releasePolicy: new DefaultDatasetReleasePolicy(),
    workflowService: new DatasetWorkflowProgressService(),
    fileIngestionService: new DefaultFileIngestionApplicationService(
      new FileIngestionPolicyService(),
      {
        async convert(request) {
          return {
            markdown: `# Converted\n\n${request.file.name}`,
            sourceFormat: request.file.extension?.replace(/^\./, "") ?? "unknown",
            outputFormat: "markdown",
            file: request.file,
            conversion: {
              strategy: "converted",
              converterId: "stub-converter",
              detectedSourceFormat: request.file.extension?.replace(/^\./, "") ?? "unknown",
            },
            warnings: [{ code: "conversion_performed", message: "converted" }],
          };
        },
      },
    ),
    executionEngine: options.executionEngine,
    createId: (() => {
      let count = 0;
      return (prefix: string) => `${prefix}-${++count}`;
    })(),
  });
}

describe("DefaultTuningDatasetStudioApplicationService", () => {
  it("runs the version-aware QA workflow from import through release and successor draft creation", async () => {
    const service = createService();
    const dataset = await service.createDataset({
      name: "Support QA Dataset",
      description: "Support answers",
      taskType: "question_answering",
      createdBy: "tester",
    });

    expect(dataset.selectedVersion?.versionNumber).toBe(1);

    const versionId = dataset.selectedVersion!.id;
    await service.importSourceDocuments({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      documents: [{
        name: "FAQ",
        content: "AI Loom Studio helps teams author governed workflows. The platform stores reusable context packs and datasets for fine-tuning. Every released version stays immutable for audit history.",
      }],
    });

    const generated = await service.generateQaExamplesFromSource({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      sourceDocumentIds: [(await service.getDatasetDetails({ datasetId: dataset.dataset.id, versionId })).sourceDocuments[0]!.id],
    });
    expect(generated.length).toBeGreaterThan(0);
    const generationDetails = await service.getDatasetDetails({ datasetId: dataset.dataset.id, versionId });
    expect(generationDetails.generationBatches[0]?.provenance.mode).toBe("heuristic-fallback");

    await service.bulkUpdateExamples({
      datasetId: dataset.dataset.id,
      versionId,
      exampleIds: generated.map((example) => example.id),
      status: "accepted",
      updatedBy: "reviewer",
      annotationNote: "Bulk accepted",
    });
    await service.assignSplitsAutomatically({ datasetId: dataset.dataset.id, versionId, actor: "tester" });
    const validation = await service.validateDatasetVersion({ datasetId: dataset.dataset.id, versionId });
    expect(validation.isValid).toBe(true);

    const released = await service.releaseDatasetVersion({ datasetId: dataset.dataset.id, versionId, releaseNotes: "Initial release" });
    expect(released.status).toBe("released");

    const artifact = await service.exportDatasetVersion({ datasetId: dataset.dataset.id, versionId, format: "qa_jsonl" });
    expect(artifact.fileName).toContain("support-qa-dataset-v1");
    expect(artifact.content).toContain('"question"');

    const successor = await service.createSuccessorDatasetVersion({ datasetId: dataset.dataset.id, releasedVersionId: versionId, createdBy: "tester" });
    expect(successor.selectedVersion?.kind).toBe("successor_draft");
    const successorExamples = await service.listExamples({ datasetId: dataset.dataset.id, versionId: successor.selectedVersion!.id });
    expect(successorExamples.every((example) => example.status === "draft")).toBe(true);
  });

  it("supports chat_completion dataset creation, generation, validation, and export", async () => {
    const service = createService();
    const dataset = await service.createDataset({
      name: "Support Chat Dataset",
      taskType: "chat_completion",
      createdBy: "tester",
    });
    const versionId = dataset.selectedVersion!.id;

    await service.importSourceDocuments({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      documents: [{ name: "Playbook", content: "Respond with grounded, concise troubleshooting guidance. Ask clarifying questions before suggesting irreversible actions. Always summarize the next step." }],
    });
    const sourceId = (await service.getDatasetDetails({ datasetId: dataset.dataset.id, versionId })).sourceDocuments[0]!.id;
    const generated = await service.generateChatExamplesFromSource({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      sourceDocumentIds: [sourceId],
    });
    expect(generated[0]?.taskType).toBe("chat_completion");

    await service.bulkUpdateExamples({ datasetId: dataset.dataset.id, versionId, exampleIds: generated.map((example) => example.id), status: "accepted", updatedBy: "reviewer" });
    await service.assignSplitsAutomatically({ datasetId: dataset.dataset.id, versionId, actor: "tester" });
    const validation = await service.validateDatasetVersion({ datasetId: dataset.dataset.id, versionId });
    expect(validation.isValid).toBe(true);
    await service.releaseDatasetVersion({ datasetId: dataset.dataset.id, versionId, releaseNotes: "chat release" });
    const artifact = await service.exportDatasetVersion({ datasetId: dataset.dataset.id, versionId, format: "openai_chat_jsonl" });
    expect(artifact.content).toContain('"messages"');
  });

  it("ingests uploaded files into normalized markdown for dataset sources", async () => {
    const service = createService();
    const dataset = await service.createDataset({
      name: "Source Upload Dataset",
      taskType: "question_answering",
      createdBy: "tester",
    });

    const versionId = dataset.selectedVersion!.id;
    const documents = await service.ingestSourceFiles({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      files: [{
        name: "brief.pdf",
        mimeType: "application/pdf",
        sizeInBytes: 8,
        content: new Uint8Array([1, 2, 3, 4]),
      }],
    });

    expect(documents).toHaveLength(1);
    expect(documents[0]?.content).toContain("Converted");
    expect(documents[0]?.mediaType).toBe("text/markdown");
    expect(documents[0]?.metadata?.sourceFormat).toBe("pdf");
  });

  it("routes dataset generation through the unified execution engine and persists execution history metadata", async () => {
    const savedRuns: any[] = [];
    const generationService = {
      generate: async () => ({
        batchId: "batch-1",
        datasetId: "dataset-1",
        versionId: "dataset_version-2",
        taskType: "question_answering" as const,
        generatedAt: new Date("2026-03-23T00:00:00.000Z"),
        generatedCount: 1,
        skippedCount: 0,
        status: "completed" as const,
        examples: [],
        provenance: {
          provider: "python-runtime",
          generatorId: "dataset-gen-runtime",
          generatorVersion: "1.0.0",
          batchId: "batch-1",
          mode: "python-runtime-local" as const,
          executionKind: "python-runtime-local" as const,
          status: "completed" as const,
          path: "runtime-local",
          isFallback: false,
          isDegraded: false,
          parameters: {},
          startedAt: new Date("2026-03-23T00:00:00.000Z"),
          executedAt: new Date("2026-03-23T00:00:01.000Z"),
          diagnostics: [],
        },
      }),
    };
    const executionEngine = new UnifiedExecutionEngine([
      new DatasetGenerationExecutionUnitHandler(generationService as any),
    ], {
      saveRun: async (run) => {
        savedRuns.push(run);
        return run;
      },
      getRunById: async () => undefined,
      listRuns: async () => savedRuns,
    });
    const service = createService({ generationService, executionEngine });
    const dataset = await service.createDataset({
      id: "dataset-1",
      name: "Engine-backed Dataset",
      taskType: "question_answering",
      createdBy: "tester",
    });
    const versionId = dataset.selectedVersion!.id;

    await service.importSourceDocuments({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      documents: [{ name: "FAQ", content: "Execution engines can coordinate dataset generation." }],
    });
    const details = await service.getDatasetDetails({ datasetId: dataset.dataset.id, versionId });

    await service.generateQaExamplesFromSource({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      sourceDocumentIds: [details.sourceDocuments[0]!.id],
    });

    expect(savedRuns.at(-1)?.metadata).toEqual({
      executionKind: "dataset-generation",
      datasetId: dataset.dataset.id,
      versionId,
      taskType: "question_answering",
      sourceDocumentCount: 1,
    });
    expect(savedRuns.at(-1)?.units[`dataset-generation:${dataset.dataset.id}:${versionId}`]?.provenance?.sourceKind).toBe("dataset-generation");
  });

});
