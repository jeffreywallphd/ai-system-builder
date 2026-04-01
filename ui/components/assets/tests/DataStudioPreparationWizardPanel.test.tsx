import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DataStudioPreparationWizardPanel from "../DataStudioPreparationWizardPanel";

describe("DataStudioPreparationWizardPanel", () => {
  it("renders wizard shell, stage navigation, and asset node palette drawer", () => {
    const html = renderToStaticMarkup(React.createElement(DataStudioPreparationWizardPanel));

    expect(html).toContain("Data Studio Preparation Wizard");
    expect(html).toContain("Pipeline template");
    expect(html).toContain("Simple Flow");
    expect(html).toContain("Advanced Flow");
    expect(html).toContain("Canvas");
    expect(html).toContain("Asset Nodes");
    expect(html).toContain("Wizard to Canvas handoff");
    expect(html).toContain("Back");
    expect(html).toContain("Next");
  });
});

