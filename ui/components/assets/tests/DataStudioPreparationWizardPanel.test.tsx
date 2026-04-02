import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DataStudioPreparationWizardPanel from "../DEPRECATED_DataStudioPreparationWizardPanel";

describe("DataStudioPreparationWizardPanel", () => {
  it("renders wizard shell, stage navigation, reusable stage UX, and advanced entry points", () => {
    const html = renderToStaticMarkup(React.createElement(DataStudioPreparationWizardPanel));

    expect(html).toContain("Data Flow Builder");
    expect(html).toContain("Flow template");
    expect(html).toContain("Basic");
    expect(html).toContain("Technical details");
    expect(html).toContain("Canvas");
    expect(html).toContain("Advanced tools");
    expect(html).toContain("Inspect technical details");
    expect(html).toContain("Edit in Canvas");
    expect(html).toContain("Technical details");
    expect(html).toContain("Pipeline stages");
    expect(html).toContain("Technical flow details");
    expect(html).toContain("Back");
    expect(html).toContain("Next");
  });
});

