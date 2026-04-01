import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowTemplateSelectionPanel from "../WorkflowTemplateSelectionPanel";

describe("WorkflowTemplateSelectionPanel", () => {
  it("renders starter template discovery/preview surface", () => {
    const html = renderToStaticMarkup(<WorkflowTemplateSelectionPanel surface="workflow-studio" />);
    expect(html).toContain("Workflow template starter selection");
    expect(html).toContain("Template category");
    expect(html).toContain("Loading templates");
    expect(html).toContain("Template preview is unavailable");
  });
});
