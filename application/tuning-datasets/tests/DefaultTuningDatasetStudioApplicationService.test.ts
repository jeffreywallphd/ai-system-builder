import { describe, expect, it } from "bun:test";
import { DefaultTuningDatasetStudioApplicationService } from "../DefaultTuningDatasetStudioApplicationService";
import { BrowserDatasetImportService, DatasetStatisticsService, DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReleasePolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, JsonTuningDatasetExportService, ProviderAgnosticDatasetGenerationService, TaskTypeAwareValidationService } from "../../../domain/tuning-datasets/TuningDatasetServices";
import { LocalStorageTuningDatasetRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function createService() {
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
    generationService: new ProviderAgnosticDatasetGenerationService(),
    reviewPolicy: new DefaultDatasetReviewPolicy(),
    duplicationPolicy,
    statisticsService: new DatasetStatisticsService(duplicationPolicy),
    releasePolicy: new DefaultDatasetReleasePolicy(),
    workflowService: new DatasetWorkflowProgressService(),
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
});
