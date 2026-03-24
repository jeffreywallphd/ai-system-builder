import { describe, expect, it } from "bun:test";
import { createModelPreparationAndTrainingExecutionPlan } from "../ModelPreparationAndTrainingExecutionPlanFactory";

describe("ModelPreparationAndTrainingExecutionPlanFactory", () => {
  it("builds a dependency-aware preparation->training plan", () => {
    const plan = createModelPreparationAndTrainingExecutionPlan({
      id: "job-1",
      name: "Train adapter",
      executionKind: "local-gradient-training",
      baseModelId: "base-1",
      baseModelName: "Base One",
      datasetId: "dataset-1",
      datasetName: "Support QA",
      datasetVersionId: "version-1",
      datasetVersionNumber: 1,
      datasetTaskType: "question_answering",
      createdBy: "tester",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
      examples: [{ id: "ex-1", taskType: "question_answering", inputText: "Q", targetText: "A" }],
    });

    expect(plan.plan.units.map((unit) => unit.id)).toEqual([
      "model-preparation:job-1:preflight",
      "model-training:job-1",
    ]);
    expect(plan.plan.getUnit("model-training:job-1")?.dependsOn).toEqual(["model-preparation:job-1:preflight"]);
    expect((plan.unitInputs["model-preparation:job-1:preflight"] as { executionKind: string }).executionKind).toBe("preparation-only");
    expect(plan.metadata.executionFlowId).toBe("model-preparation-training:job-1");
    expect(plan.metadata.supportsMultiUnitComposition).toBe(true);
  });
});
