import { describe, expect, it } from "bun:test";
import { buildDatasetWorkflowWizard } from "../buildDatasetWorkflowWizard";

describe("buildDatasetWorkflowWizard", () => {
  it("maps dataset workflow state into a reusable linear wizard definition", () => {
    const wizard = buildDatasetWorkflowWizard({
      workflow: {
        datasetId: "dataset-1",
        versionId: "version-1",
        currentStage: "validation",
        completedStages: ["dataset_definition", "source_ingestion", "example_generation", "review_editing"],
        stageStates: [
          { stage: "dataset_definition", status: "completed" },
          { stage: "source_ingestion", status: "completed" },
          { stage: "example_generation", status: "completed" },
          { stage: "review_editing", status: "completed" },
          { stage: "validation", status: "current" },
          { stage: "split_assignment", status: "pending" },
          { stage: "release", status: "pending" },
          { stage: "export", status: "pending" },
        ],
        progressPercent: 50,
        lastVisitedStage: "validation",
        updatedAt: new Date("2026-03-21T00:00:00.000Z"),
      },
    });

    expect(wizard.currentStepId).toBe("validation");
    expect(wizard.previousStepId).toBe("review_editing");
    expect(wizard.nextStepId).toBe("split_assignment");
    expect(wizard.steps[4]?.title).toBe("Validate");
    expect(wizard.steps[5]?.isAccessible).toBe(false);
  });
});
