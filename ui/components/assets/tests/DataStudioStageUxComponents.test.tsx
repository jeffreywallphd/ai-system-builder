import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataStudioPreparationWizardStateAdapter } from "../../../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import {
  DataStudioAdvancedEditingActions,
  DataStudioNodePaletteDrawer,
  DataStudioStageInternalsPanel,
  DataStudioStageMetadataPanel,
} from "../data-studio/DataStudioStageUxComponents";

describe("DataStudioStageUxComponents", () => {
  it("renders stage metadata, internals, and advanced editing actions from shared stage snapshots", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const stage = adapter.getCurrentStage();
    const internals = stage ? adapter.getStageInternals(stage.stageId) : undefined;

    if (!stage || !internals) {
      throw new Error("Expected default Data Studio stage and internals to be present.");
    }

    const html = renderToStaticMarkup(
      <div>
        <DataStudioStageMetadataPanel stage={stage} totalStages={adapter.getSnapshot().stages.length} />
        <DataStudioAdvancedEditingActions
          stageId={stage.stageId}
          stageTitle={stage.title}
          mode="wizard"
          onInspectInternals={() => undefined}
          onEditInCanvas={() => undefined}
        />
        <DataStudioStageInternalsPanel internals={internals} />
      </div>,
    );

    expect(html).toContain(stage.title);
    expect(html).toContain("Advanced editing");
    expect(html).toContain("Inspect internals");
    expect(html).toContain("Stage options (canonical)");
    expect(html).toContain("Graph references");
  });

  it("renders node palette drawer entries with focus and internals actions", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const stages = adapter.getSnapshot().stages.slice(0, 3);

    const html = renderToStaticMarkup(
      <DataStudioNodePaletteDrawer
        isOpen
        searchValue=""
        stages={stages}
        onClose={() => undefined}
        onSearchChange={() => undefined}
        onFocusStage={() => undefined}
        onInspectStage={() => undefined}
      />,
    );

    expect(html).toContain("Asset Nodes");
    expect(html).toContain("Focus stage");
    expect(html).toContain("Inspect internals");
    expect(html).toContain(stages[0]?.title ?? "");
  });
});
