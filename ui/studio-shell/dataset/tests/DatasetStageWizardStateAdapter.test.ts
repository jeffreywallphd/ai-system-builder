import { describe, expect, it } from "bun:test";
import { DatasetStageWizardStateAdapter } from "../DatasetStageWizardStateAdapter";

describe("DatasetStageWizardStateAdapter", () => {
  it("creates a stage-based wizard snapshot with current/completed/pending statuses", () => {
    const adapter = new DatasetStageWizardStateAdapter({ templateId: "elt-default" });
    const initial = adapter.getSnapshot();

    expect(initial.currentStageId).toBe("source");
    expect(initial.currentStage?.status).toBe("current");
    expect(initial.stages.length).toBeGreaterThan(0);

    adapter.goNext();
    const afterNext = adapter.getSnapshot();
    expect(afterNext.currentStageId).toBe("ingestion");
    expect(afterNext.stages.find((stage) => stage.id === "source")?.status).toBe("completed");
  });

  it("updates stage configuration through the wizard state adapter", () => {
    const adapter = new DatasetStageWizardStateAdapter({ templateId: "elt-default" });
    adapter.updateStageConfiguration("source", Object.freeze({
      sourceKind: "json",
      sourceReference: "in-memory://dataset-source",
    }));

    const snapshot = adapter.getSnapshot();
    expect(snapshot.stages.find((stage) => stage.id === "source")?.configuration.sourceKind).toBe("json");
  });
});
