import { describe, expect, it } from "bun:test";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import DataStudioSchemaStudioEntryPanel from "../data-studio/DataStudioSchemaStudioEntryPanel";

describe("DataStudioSchemaStudioEntryPanel", () => {
  it("renders a dedicated schema workspace entry point from Data Studio", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/studio-shell/dataset"]}>
        <DataStudioSchemaStudioEntryPanel />
      </MemoryRouter>,
    );

    expect(html).toContain("Data structure workspace");
    expect(html).toContain("Create new schema");
    expect(html).toContain("Loading available schemas");
  });
});
