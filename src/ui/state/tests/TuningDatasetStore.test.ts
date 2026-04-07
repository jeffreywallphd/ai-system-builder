import { describe, expect, it } from "bun:test";
import { TuningDatasetStore } from "../TuningDatasetStore";
import { TuningDatasetService } from "../../services/TuningDatasetService";
import { DefaultTuningDatasetStudioApplicationService } from "@application/tuning-datasets/DefaultTuningDatasetStudioApplicationService";
import { BrowserDatasetImportService, DatasetStatisticsService, DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReleasePolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, JsonTuningDatasetExportService, ProviderAgnosticDatasetGenerationService, TaskTypeAwareValidationService } from "@domain/tuning-datasets/TuningDatasetServices";
import { LocalStorageTuningDatasetRepository } from "@infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "@infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";

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
  return new TuningDatasetStore(new TuningDatasetService(applicationService));
}

describe("TuningDatasetStore", () => {
  it("runs the wizard-oriented QA workflow through store actions", async () => {
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
    expect(stateAfterCreate.currentWorkflowStage).toBe("source_ingestion");
    expect(stateAfterCreate.wizard.currentStepId).toBe("source_ingestion");

    const versionId = stateAfterCreate.selectedVersionId!;
    await store.importSources(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user", [{
      name: "Store Doc",
      content: "Store QA keeps datasets versioned. Store QA validates examples and exports JSONL artifacts. Successor drafts clone released versions for further editing.",
    }]);
    expect(store.getState().sourceDocuments).toHaveLength(1);
    expect(store.getState().currentWorkflowStage).toBe("example_generation");
    expect(store.getState().wizard.previousStepId).toBe("source_ingestion");

    await store.generateExamples(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user", [store.getState().sourceDocuments[0]!.id]);
    expect(store.getState().examples.length).toBeGreaterThan(0);

    for (const example of store.getState().examples) {
      store.toggleExampleSelection(example.id);
    }
    await store.bulkUpdateSelection({ status: "accepted", split: "validation", annotationNote: "bulk", updatedBy: "reviewer" });
    await store.assignSplits(stateAfterCreate.selectedDataset!.dataset.id, versionId, "ui-user");
    await store.validateDataset(stateAfterCreate.selectedDataset!.dataset.id, versionId);
    await store.releaseVersion(stateAfterCreate.selectedDataset!.dataset.id, versionId, "release");
    const artifact = await store.exportVersion(stateAfterCreate.selectedDataset!.dataset.id, versionId, "qa_jsonl");

    expect(store.getState().selectedDataset?.selectedVersion?.status).toBe("released");
    expect(store.getState().workflow?.currentStage).toBe("export");
    expect(artifact.format).toBe("qa_jsonl");
  });
});

