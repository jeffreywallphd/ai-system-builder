import { describe, expect, it } from "bun:test";
import { QuestionAnsweringExample, TuningDataset, TuningDatasetVersion } from "../TuningDatasetEntities";
import { DefaultDatasetDuplicationPolicy, DeterministicDatasetSplitService, QuestionAnsweringValidationService } from "../TuningDatasetServices";

function createExample(id: string, overrides: Partial<{ question: string; answer: string; context: string }> = {}) {
  return new QuestionAnsweringExample({
    id,
    datasetId: "dataset-1",
    versionId: "version-1",
    question: overrides.question ?? "What is AI Loom Studio?",
    answer: overrides.answer ?? "AI Loom Studio is a governed authoring environment.",
    context: overrides.context ?? "AI Loom Studio is a governed authoring environment for workflows, tools, and context.",
    createdBy: "tester",
  });
}

describe("Tuning dataset domain", () => {
  it("enforces dataset invariants and task-type immutability after examples exist", () => {
    const dataset = new TuningDataset({
      id: "dataset-1",
      name: "QA Dataset",
      taskType: "question_answering",
      createdBy: "tester",
    });

    expect(() => dataset.withTaskType("classification", true)).toThrow("Dataset task type cannot change once examples exist.");
    expect(() => new TuningDataset({ id: "", name: "Bad", taskType: "question_answering", createdBy: "tester" })).toThrow();
  });

  it("prevents mutating released versions", () => {
    const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
    const validationService = new QuestionAnsweringValidationService(duplicationPolicy);
    const version = new TuningDatasetVersion({
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
    });
    const dataset = new TuningDataset({ id: "dataset-1", name: "QA Dataset", taskType: "question_answering", createdBy: "tester" });
    const validation = validationService.validateVersion({ dataset, version, examples: [createExample("example-1").withStatus("accepted")] });
    const released = version.release("release", validation);

    expect(released.status).toBe("released");
    expect(() => released.assertMutable()).toThrow("immutable");
  });

  it("validates QA examples, assigns splits, and detects duplicates", () => {
    const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
    const validationService = new QuestionAnsweringValidationService(duplicationPolicy);
    const splitService = new DeterministicDatasetSplitService();
    const dataset = new TuningDataset({ id: "dataset-1", name: "QA Dataset", taskType: "question_answering", createdBy: "tester" });
    const version = new TuningDatasetVersion({
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
    });

    expect(() => createExample("bad-example", { question: " " })).toThrow("QuestionAnsweringExample.question cannot be empty.");
    const duplicateA = createExample("example-a");
    const duplicateB = createExample("example-b");
    const reviewCandidate = createExample("example-c").withStatus("needs_review");
    const assigned = splitService.assign([duplicateA, duplicateB, reviewCandidate], "tester") as ReadonlyArray<QuestionAnsweringExample>;
    const validation = validationService.validateVersion({ dataset, version, examples: assigned });

    expect(assigned[0]?.split).toBe("test");
    expect(validation.warningCount).toBeGreaterThan(0);
    expect(duplicationPolicy.detectDuplicates([duplicateA, duplicateB])).toHaveLength(1);
  });
});
