import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetStageAuthoringPanel from "../DatasetStageAuthoringPanel";

describe("DatasetStageAuthoringPanel", () => {
  it("renders wizard/canvas mode controls and shared stage authoring shell", () => {
    const html = renderToStaticMarkup(React.createElement(DatasetStageAuthoringPanel, {
      templateId: "elt-default",
    }));

    expect(html).toContain("Dataset Stage Authoring");
    expect(html).toContain("Wizard");
    expect(html).toContain("Canvas");
    expect(html).toContain("Dataset Stage Wizard");
  });
});
