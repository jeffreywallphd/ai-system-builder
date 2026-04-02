import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetStageWizardPanel from "../DEPRECATED_DatasetStageWizardPanel";

describe("DatasetStageWizardPanel", () => {
  it("renders stage wizard shell, progress navigation, fallback renderer, and navigation controls", () => {
    const html = renderToStaticMarkup(React.createElement(DatasetStageWizardPanel, {
      templateId: "elt-default",
    }));

    expect(html).toContain("Dataset Stage Wizard");
    expect(html).toContain("Stage 1 of");
    expect(html).toContain("Back");
    expect(html).toContain("Next");
    expect(html).toContain("Show advanced details");
    expect(html).toContain("Source configuration");
  });
});
