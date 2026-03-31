import { describe, expect, it } from "bun:test";
import { DatasetStageWizardStateAdapter } from "../DatasetStageWizardStateAdapter";

describe("DatasetStageWizardStateAdapter", () => {
  it("keeps wizard and canvas projections synchronized after stage edits", () => {
    const adapter = new DatasetStageWizardStateAdapter({ templateId: "elt-default" });

    const beforeWizard = adapter.getSnapshot();
    const beforeCanvas = adapter.getCanvasGraph();
    expect(beforeCanvas.metadata.stageCount).toBe(beforeWizard.stages.length);

    const configResult = adapter.updateStageConfiguration(
      beforeWizard.currentStageId,
      Object.freeze({ sourceKind: "json" }),
    );
    expect(configResult.ok).toBeTrue();

    adapter.goNext();

    const afterWizard = adapter.getSnapshot();
    const afterCanvas = adapter.regenerateGraph();
    expect(afterCanvas.metadata.currentStageId).toBe(afterWizard.currentStageId);

    const sourceStage = afterCanvas.groups.find((group) => group.stageId === beforeWizard.currentStageId);
    expect(sourceStage?.metadata.configuration.sourceKind).toBe("json");
  });

  it("surfaces invalid edits and preserves valid graph composition", () => {
    const adapter = new DatasetStageWizardStateAdapter({ templateId: "document-default" });

    const invalid = adapter.removeOptionalStage("source");
    expect(invalid.ok).toBeFalse();

    const valid = adapter.removeOptionalStage("extraction");
    expect(valid.ok).toBeTrue();

    const graph = adapter.getCanvasGraph();
    expect(graph.groups.some((group) => group.stageId === "extraction")).toBeFalse();
    expect(graph.nodes.every((node) => node.stageId !== "extraction")).toBeTrue();
  });
});
