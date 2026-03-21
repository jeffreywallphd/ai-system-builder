import { describe, expect, it } from "bun:test";
import { ChatCompletionExample, QuestionAnsweringExample, TuningDataset, TuningDatasetVersion } from "../TuningDatasetEntities";
import { DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetReleasePolicy, DeterministicDatasetSplitService, TaskTypeAwareValidationService } from "../TuningDatasetServices";

function createQaExample(id: string, overrides: Partial<{ question: string; answer: string; context: string; status: "draft" | "accepted" | "rejected" | "needs_review" }> = {}) {
  return new QuestionAnsweringExample({
    id,
    datasetId: "dataset-1",
    versionId: "version-1",
    question: overrides.question ?? "What is AI Loom Studio?",
    answer: overrides.answer ?? "AI Loom Studio is a governed authoring environment.",
    context: overrides.context ?? "AI Loom Studio is a governed authoring environment for workflows, tools, and context.",
    status: overrides.status,
    createdBy: "tester",
  });
}

describe("Tuning dataset domain", () => {
  it("enforces dataset invariants and version selection state", () => {
    const dataset = new TuningDataset({
      id: "dataset-1",
      name: "QA Dataset",
      taskType: "question_answering",
      createdBy: "tester",
    });

    expect(() => dataset.withTaskType("classification", true)).toThrow("Dataset task type cannot change once examples exist.");
    expect(() => new TuningDataset({ id: "", name: "Bad", taskType: "question_answering", createdBy: "tester" })).toThrow();
    expect(dataset.selectVersion("version-2").selectedVersionId).toBe("version-2");
  });

  it("creates immutable releases and successor drafts from released versions", () => {
    const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
    const validationService = new TaskTypeAwareValidationService(duplicationPolicy);
    const releasePolicy = new DefaultDatasetReleasePolicy();
    const version = new TuningDatasetVersion({
      id: "version-1",
      datasetId: "dataset-1",
      versionNumber: 1,
      createdBy: "tester",
      schema: {
        taskType: "question_answering",
        schemaVersion: "2.0.0",
        canonicalExampleType: "generative_qa",
        requiredFields: ["question", "answer", "context"],
      },
    });
    const dataset = new TuningDataset({ id: "dataset-1", name: "QA Dataset", taskType: "question_answering", createdBy: "tester" });
    const examples = [createQaExample("example-1", { status: "accepted" }), createQaExample("example-2", { status: "accepted" }).withContent({ split: "validation" }), createQaExample("example-3", { status: "accepted" }).withContent({ split: "test" })];
    const validation = validationService.validateVersion({ dataset, version, examples, sourceDocuments: [] });
    const readiness = releasePolicy.evaluate({ dataset, version, examples, validation });
    const released = version.release({ releaseNotes: "release", validationResult: { ...validation, readiness } });

    expect(released.status).toBe("released");
    expect(() => released.assertMutable()).toThrow("immutable");
    const successor = released.createDraftSuccessor({ id: "version-2", versionNumber: 2, createdBy: "tester" });
    expect(successor.kind).toBe("successor_draft");
    expect(successor.parentVersionId).toBe(released.id);
  });

  it("validates QA and chat examples, assigns splits, and tracks workflow progress", () => {
    const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
    const validationService = new TaskTypeAwareValidationService(duplicationPolicy);
    const splitService = new DeterministicDatasetSplitService();
    const workflowService = new DatasetWorkflowProgressService();
    const qaDataset = new TuningDataset({ id: "dataset-1", name: "QA Dataset", taskType: "question_answering", createdBy: "tester" });
    const qaVersion = new TuningDatasetVersion({
      id: "version-1",
      datasetId: "dataset-1",
      versionNumber: 1,
      createdBy: "tester",
      schema: {
        taskType: "question_answering",
        schemaVersion: "2.0.0",
        canonicalExampleType: "generative_qa",
        requiredFields: ["question", "answer", "context"],
      },
    });
    const duplicateA = createQaExample("example-a", { status: "accepted" });
    const duplicateB = createQaExample("example-b", { status: "accepted" });
    const reviewCandidate = createQaExample("example-c", { status: "needs_review" });
    const assigned = splitService.assign([duplicateA, duplicateB, reviewCandidate], "tester") as ReadonlyArray<QuestionAnsweringExample>;
    const qaValidation = validationService.validateVersion({ dataset: qaDataset, version: qaVersion, examples: assigned, sourceDocuments: [] });

    expect(assigned[0]?.split).toBe("test");
    expect(qaValidation.warningCount).toBeGreaterThan(0);
    expect(duplicationPolicy.detectDuplicates([duplicateA, duplicateB])).toHaveLength(1);

    const chatDataset = new TuningDataset({ id: "dataset-2", name: "Chat Dataset", taskType: "chat_completion", createdBy: "tester" });
    const chatVersion = new TuningDatasetVersion({
      id: "version-chat",
      datasetId: "dataset-2",
      versionNumber: 1,
      createdBy: "tester",
      schema: {
        taskType: "chat_completion",
        schemaVersion: "2.0.0",
        canonicalExampleType: "chat_messages",
        requiredFields: ["messages"],
      },
    });
    const chatExample = new ChatCompletionExample({
      id: "chat-1",
      datasetId: "dataset-2",
      versionId: "version-chat",
      messages: [{ role: "system", content: "You are helpful." }, { role: "user", content: "Hello" }, { role: "assistant", content: "Hi there" }],
      status: "accepted",
      split: "train",
      createdBy: "tester",
    });
    const chatValidation = validationService.validateVersion({ dataset: chatDataset, version: chatVersion, examples: [chatExample], sourceDocuments: [] });
    expect(chatValidation.isValid).toBe(true);
    expect(chatValidation.issues.some((issue) => issue.code === "chat-missing-assistant-finish")).toBe(false);

    const workflow = workflowService.reconcile({
      datasetId: qaDataset.id,
      versionId: qaVersion.id,
      hasDefinition: true,
      sourceCount: 1,
      exampleCount: 3,
      validation: qaValidation,
      version: qaVersion,
      exportCount: 0,
    });
    expect(workflow.currentStage).toBe("review_editing");
  });
});
