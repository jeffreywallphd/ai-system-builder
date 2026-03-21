import { describe, expect, it } from "bun:test";
import { DefaultTuningDatasetStudioApplicationService } from "../DefaultTuningDatasetStudioApplicationService";
import { BrowserDatasetImportService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, HeuristicQuestionAnsweringGenerationService, JsonTuningDatasetExportService, QuestionAnsweringValidationService, DatasetStatisticsService } from "../../../domain/tuning-datasets/TuningDatasetServices";
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
    validationService: new QuestionAnsweringValidationService(duplicationPolicy),
    splitService: new DeterministicDatasetSplitService(),
    exportService: new JsonTuningDatasetExportService(),
    importService: new BrowserDatasetImportService(new DefaultDatasetPrivacyPolicy()),
    generationService: new HeuristicQuestionAnsweringGenerationService(),
    reviewPolicy: new DefaultDatasetReviewPolicy(),
    duplicationPolicy,
    statisticsService: new DatasetStatisticsService(duplicationPolicy),
    createId: (() => {
      let count = 0;
      return (prefix: string) => `${prefix}-${++count}`;
    })(),
  });
}

describe("DefaultTuningDatasetStudioApplicationService", () => {
  it("creates datasets, ingests sources, generates examples, validates, releases, and exports", async () => {
    const service = createService();
    const dataset = await service.createDataset({
      name: "Support QA Dataset",
      description: "Support answers",
      taskType: "question_answering",
      createdBy: "tester",
    });

    expect(dataset.latestVersion?.versionNumber).toBe(1);

    const versionId = dataset.latestVersion!.id;
    await service.importSourceDocuments({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      documents: [{
        name: "FAQ",
        content: "AI Loom Studio helps teams author governed workflows. The platform stores reusable context packs and datasets for fine-tuning.",
      }],
    });

    const detailsAfterImport = await service.getDatasetDetails({ datasetId: dataset.dataset.id });
    expect(detailsAfterImport.sourceDocuments).toHaveLength(1);

    const generated = await service.generateQaExamplesFromSource({
      datasetId: dataset.dataset.id,
      versionId,
      createdBy: "tester",
      sourceDocumentIds: [detailsAfterImport.sourceDocuments[0]!.id],
    });
    expect(generated.length).toBeGreaterThan(0);

    await service.acceptExample({ datasetId: dataset.dataset.id, versionId, exampleId: generated[0]!.id, reviewer: "reviewer", note: "Looks good" });
    await service.assignSplitsAutomatically({ datasetId: dataset.dataset.id, versionId, actor: "tester" });
    const validation = await service.validateDatasetVersion({ datasetId: dataset.dataset.id, versionId });
    expect(validation.isValid).toBe(true);

    const released = await service.releaseDatasetVersion({ datasetId: dataset.dataset.id, versionId, releaseNotes: "Initial release" });
    expect(released.status).toBe("released");

    const artifact = await service.exportDatasetVersion({ datasetId: dataset.dataset.id, versionId, format: "qa_jsonl" });
    expect(artifact.fileName).toContain("support-qa-dataset-v1");
    expect(artifact.content).toContain('"question"');
  });
});
