import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DataStudioPreparationWizardPanel from "../DataStudioPreparationWizardPanel";

describe("DataStudioPreparationWizardPanel", () => {
  it("renders wizard shell, stage navigation, reusable stage UX, and advanced entry points", () => {
    const html = renderToStaticMarkup(React.createElement(DataStudioPreparationWizardPanel));

    expect(html).toContain("Data Studio Preparation Wizard");
    expect(html).toContain("Pipeline template");
    expect(html).toContain("Simple Flow");
    expect(html).toContain("Advanced Flow");
    expect(html).toContain("Canvas");
    expect(html).toContain("Advanced editing");
    expect(html).toContain("Inspect internals");
    expect(html).toContain("Edit in Canvas");
    expect(html).toContain("Internals");
    expect(html).toContain("Asset Nodes");
    expect(html).toContain("Wizard to Canvas handoff");
    expect(html).toContain("Back");
    expect(html).toContain("Next");
  });
});

