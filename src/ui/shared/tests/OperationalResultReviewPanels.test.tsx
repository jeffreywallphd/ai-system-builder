import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OperationalResultReviewPanels,
  resolveAssetReviewReferences,
  type OperationalResultReviewEntry,
} from "../operations";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("OperationalResultReviewPanels", () => {
  it("renders output cards, detail metadata, and protected action states", () => {
    const entry: OperationalResultReviewEntry = Object.freeze({
      executionId: "run:1",
      status: "succeeded",
      rootAssetId: "asset:root:1",
      rootVersionId: "asset:root:1:v1",
      outputFieldCount: 2,
      outputContractIds: Object.freeze(["contract:1"]),
      outputAssetIds: Object.freeze(["asset:output:1"]),
    });

    const html = renderToStaticMarkup(
      React.createElement(OperationalResultReviewPanels, {
        entries: Object.freeze([entry]),
        selectedExecutionId: "run:1",
        detailIsLoading: false,
        responsiveProfile: createSurfaceResponsiveProfile({ viewportWidthPx: 1200 }),
        assetDetailsByExecutionAndAssetId: Object.freeze({
          "run:1": Object.freeze({
            "asset:root:1": Object.freeze({
              assetId: "asset:root:1",
              kind: "generated-output",
              visibility: "workspace",
              allowedActions: Object.freeze({
                canInitiateUpload: false,
                canAuthorizeDownload: true,
                canResolvePreview: false,
                canArchive: false,
                canDelete: false,
              }),
            }) as any,
          }),
        }),
        actionStateByExecutionAndAssetId: Object.freeze({
          "run:1": Object.freeze({
            "asset:root:1": Object.freeze({
              previewStatus: "ready",
              previewMessage: "Preview authorized.",
              previewPath: "/api/v1/assets/asset%3Aroot%3A1/downloads/content?workspaceId=workspace-1&contentToken=preview-token",
              downloadStatus: "ready",
              downloadMessage: "Download authorized.",
              downloadPath: "/api/v1/assets/asset%3Aroot%3A1/downloads/content?workspaceId=workspace-1&contentToken=download-token",
            }),
          }),
        }),
        onSelectExecution: () => undefined,
        onRequestPreview: () => undefined,
        onRequestDownload: () => undefined,
      }),
    );

    expect(html).toContain("Result and output review");
    expect(html).toContain("run:1");
    expect(html).toContain("Root asset: asset:root:1");
    expect(html).toContain("Protected asset references");
    expect(html).toContain("Preview is restricted by policy for this asset.");
    expect(html).toContain("Open protected preview");
    expect(html).toContain("Download authorized asset");
    expect(html).toContain("ui-operational-truncate");
  });

  it("renders step-by-step result review copy for mobile viewport", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalResultReviewPanels, {
        entries: Object.freeze([
          Object.freeze({
            executionId: "run:mobile:1",
            status: "running",
            outputFieldCount: 1,
            outputContractIds: Object.freeze(["contract:mobile"]),
            outputAssetIds: Object.freeze([]),
          }),
        ]),
        selectedExecutionId: "run:mobile:1",
        detailIsLoading: false,
        responsiveProfile: createSurfaceResponsiveProfile({ viewportWidthPx: 430 }),
        onSelectExecution: () => undefined,
        onRequestPreview: () => undefined,
        onRequestDownload: () => undefined,
      }),
    );

    expect(html).toContain("Step 1: Select a run output card.");
    expect(html).toContain("Step 2: Review metadata and protected asset actions.");
  });

  it("deduplicates root and output asset references", () => {
    const references = resolveAssetReviewReferences(Object.freeze({
      executionId: "run:2",
      status: "succeeded",
      rootAssetId: "asset:root:2",
      outputFieldCount: 1,
      outputContractIds: Object.freeze([]),
      outputAssetIds: Object.freeze(["asset:root:2", "asset:output:2"]),
    }));

    expect(references).toEqual(["asset:root:2", "asset:output:2"]);
  });
});
