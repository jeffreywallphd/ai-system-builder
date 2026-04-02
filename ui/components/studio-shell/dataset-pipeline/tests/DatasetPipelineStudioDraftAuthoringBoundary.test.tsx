import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { serializeDatasetPipelineAssetDocument } from "../../../../../domain/dataset-pipeline-studio/DatasetPipelineAssetDocument";
import DatasetPipelineStudioDraftAuthoringBoundary from "../DatasetPipelineStudioDraftAuthoringBoundary";

describe("DatasetPipelineStudioDraftAuthoringBoundary", () => {
  it("renders transformation-focused messaging and schema linkage controls", () => {
    const html = renderToStaticMarkup(
      <DatasetPipelineStudioDraftAuthoringBoundary
        content={serializeDatasetPipelineAssetDocument({
          schemaVersion: "ai-loom.dataset-pipeline-draft.v1",
          datasetPipelineSpec: {
            sources: [{ datasetRef: "dataset:raw:v1" }],
            steps: [{ id: "transform", kind: "dataset-transformation" }],
            schemas: {
              input: { assetId: "asset:schema:input" },
              output: { assetId: "asset:schema:output" },
            },
          },
        })}
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="dataset-pipeline-studio-boundary"');
    expect(html).toContain("Pipeline flow setup");
    expect(html).toContain("Schema links only");
    expect(html).toContain("Pipeline input");
    expect(html).toContain("Pipeline output");
    expect(html).toContain("Pipeline draft document");
  });
});
