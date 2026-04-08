import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SystemStudioWorkManagementPanel } from "../SystemStudioWorkManagementPanel";

describe("SystemStudioWorkManagementPanel", () => {
  it("renders user-friendly save/open/copy/rename actions with collapsed advanced details", () => {
    const html = renderToStaticMarkup(
      <SystemStudioWorkManagementPanel
        context={{
          studioId: "studio-system",
          snapshot: {
            studioId: "studio-system",
            studioName: "System Studio",
            activeSessionId: "session-1",
            sessionStatus: "active",
            draft: {
              id: "draft-1",
              draftId: "draft-1",
              assetId: "studio-asset:draft-1",
              lifecycleStatus: "draft",
              metadata: {
                title: "My image setup",
                tags: [],
              },
              dependencies: [],
              content: JSON.stringify({
                systemSpec: {
                  serialization: {
                    runtime: {
                      workflowBindings: [{ bindingId: "component:primary", workflowAssetId: "workflow:image", workflowVersionId: "workflow:image:v1" }],
                      datasetInstances: [{ instanceId: "dataset-instance:input", datasetAssetId: "dataset:images", datasetVersionId: "dataset:images:v1" }],
                    },
                  },
                },
              }),
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
              revision: 1,
              lastPublishedVersionId: undefined,
            },
            versions: [],
          },
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {
            refresh: async () => {},
            setDraftContent: () => {},
          },
        }}
      />,
    );

    expect(html).toContain("Save work");
    expect(html).toContain("Open saved setup");
    expect(html).toContain("Make a copy");
    expect(html).toContain("Rename this work");
    expect(html).toContain("Supported workflow operations");
    expect(html).toContain("Select a supported workflow");
    expect(html).toContain("Advanced setup changes");
  });
});
