import { describe, expect, it } from "bun:test";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import DataStudioPipelineStudioEntryPanel from "../data-studio/DataStudioPipelineStudioEntryPanel";

describe("DataStudioPipelineStudioEntryPanel", () => {
  it("renders a dedicated pipeline workspace entry point from Data Studio", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/studio-shell/dataset"]}>
        <DataStudioPipelineStudioEntryPanel />
      </MemoryRouter>,
    );

    expect(html).toContain("Data flow workspace");
    expect(html).toContain("Create new pipeline");
    expect(html).toContain("Loading available pipelines");
  });
});
