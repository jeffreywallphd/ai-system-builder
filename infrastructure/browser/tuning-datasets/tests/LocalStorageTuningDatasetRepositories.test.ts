import { describe, expect, it } from "bun:test";
import { TuningDataset, TuningDatasetVersion, QuestionAnsweringExample, SourceDocumentReference, DatasetExportRecord } from "../../../../domain/tuning-datasets/TuningDatasetEntities";
import { LocalStorageTuningDatasetRepository } from "../LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "../LocalStorageTuningDatasetVersionRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("LocalStorage tuning dataset repositories", () => {
  it("persists datasets, versions, examples, sources, and export artifacts", async () => {
    const storage = new MemoryStorage();
    const datasetRepository = new LocalStorageTuningDatasetRepository("repo-test", storage as never);
    const versionRepository = new LocalStorageTuningDatasetVersionRepository(storage as never);

    await datasetRepository.save(new TuningDataset({
      id: "dataset-1",
      name: "Repo Dataset",
      taskType: "question_answering",
      createdBy: "tester",
    }));
    await versionRepository.saveVersion(new TuningDatasetVersion({
      id: "version-1",
      datasetId: "dataset-1",
      versionNumber: 1,
      createdBy: "tester",
      schema: {
        taskType: "question_answering",
        schemaVersion: "1.0.0",
        canonicalExampleType: "generative_qa",
        requiredFields: ["question", "answer", "context"],
      },
    }));
    await versionRepository.saveSourceDocument(new SourceDocumentReference({
      id: "source-1",
      datasetId: "dataset-1",
      versionId: "version-1",
      name: "Doc",
      content: "Context content",
      createdBy: "tester",
    }));
    await versionRepository.saveExample(new QuestionAnsweringExample({
      id: "example-1",
      datasetId: "dataset-1",
      versionId: "version-1",
      question: "What is stored?",
      answer: "Context content",
      context: "Context content",
      sourceDocumentId: "source-1",
      createdBy: "tester",
    }));
    await versionRepository.saveExportArtifact(new DatasetExportRecord({
      id: "export-1",
      datasetId: "dataset-1",
      versionId: "version-1",
      format: "qa_jsonl",
      fileName: "repo-dataset-v1.jsonl",
      contentType: "application/x-ndjson",
      content: '{"question":"What is stored?"}',
      checksum: "chk_1",
    }));

    const loadedDataset = await datasetRepository.load("dataset-1");
    const versions = await versionRepository.listVersions("dataset-1");
    const examples = await versionRepository.listExamples({ datasetId: "dataset-1", versionId: "version-1", search: "stored" });
    const exports = await versionRepository.listExportArtifacts("dataset-1", "version-1");

    expect(loadedDataset?.name).toBe("Repo Dataset");
    expect(versions).toHaveLength(1);
    expect(examples[0]).toBeInstanceOf(QuestionAnsweringExample);
    expect(exports[0]?.fileName).toBe("repo-dataset-v1.jsonl");
  });
});
