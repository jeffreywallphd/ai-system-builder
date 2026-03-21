import { describe, expect, it } from "bun:test";
import { TuningDatasetStore } from "../TuningDatasetStore";
import { TuningDatasetService } from "../../services/TuningDatasetService";
import { DefaultTuningDatasetStudioApplicationService } from "../../../application/tuning-datasets/DefaultTuningDatasetStudioApplicationService";
import { BrowserDatasetImportService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, HeuristicQuestionAnsweringGenerationService, JsonTuningDatasetExportService, QuestionAnsweringValidationService, DatasetStatisticsService } from "../../../domain/tuning-datasets/TuningDatasetServices";
import { LocalStorageTuningDatasetRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "../../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function createStore(): TuningDatasetStore {
  const storage = new MemoryStorage();
  const datasetRepository = new LocalStorageTuningDatasetRepository("store-test", storage as never);
  const versionRepository = new LocalStorageTuningDatasetVersionRepository(storage as never);
  const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
  const applicationService = new DefaultTuningDatasetStudioApplicationService({
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
  return new TuningDatasetStore(new TuningDatasetService(applicationService));
}

describe("TuningDatasetStore", () => {
  it("runs the generative QA workflow through store actions", async () => {
    const store = createStore();
    await store.initialize();
    expect(store.getState().datasets).toEqual([]);

    await store.createDataset({
      name: "Store QA",
      description: "UI store dataset",
      taskType: "question_answering",
      createdBy: "ui-user",
    });
    const stateAfterCreate = store.getState();
    expect(stateAfterCreate.selectedDataset?.dataset.name).toBe("Store QA");

    const versionId = stateAfterCreate.selectedDataset!.latestVersion!.id;
    await store.importSources(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user", [{
      name: "Store Doc",
      content: "Store QA keeps datasets versioned. Store QA validates examples and exports JSONL artifacts.",
    }]);
    expect(store.getState().sourceDocuments).toHaveLength(1);

    await store.generateQaExamples(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user", [store.getState().sourceDocuments[0]!.id]);
    expect(store.getState().examples.length).toBeGreaterThan(0);

    const exampleId = store.getState().examples[0]!.id;
    await store.reviewExample(stateAfterCreate.selectedDataset!.dataset.id, versionId, exampleId, "accepted", "reviewer", "accept");
    await store.validateDataset(stateAfterCreate.selectedDataset!.dataset.id, versionId);
    await store.assignSplits(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user");
    await store.releaseVersion(stateAfterCreate.selectedDataset!.dataset.id, versionId, "release");
    const artifact = await store.exportVersion(stateAfterCreate.selectedDataset!.dataset.id, versionId, "qa_jsonl");

    expect(store.getState().selectedDataset?.latestVersion?.status).toBe("released");
    expect(artifact.format).toBe("qa_jsonl");
  });
});
