import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import DatasetStudioDraftAuthoringBoundary from "../dataset/DatasetStudioDraftAuthoringBoundary";

describe("DatasetStudioDraftAuthoringBoundary", () => {
  it("renders asset-native wizard surface with direct Data Studio stage editing", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><DatasetStudioDraftAuthoringBoundary
        content=""
        extensionContext={{
          studioId: "dataset-studio",
          snapshot: undefined,
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        }}
      />
      </MemoryRouter>,
    );

    expect(html).toContain('data-testid="dataset-studio-wizard-surface"');
    expect(html).toContain("Data Flow Builder");
    expect(html).toContain("Data workspaces");
  });
});
