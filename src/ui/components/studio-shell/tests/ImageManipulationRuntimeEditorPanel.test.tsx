import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";
import ImageManipulationRuntimeEditorPanel from "../ImageManipulationRuntimeEditorPanel";

describe("ImageManipulationRuntimeEditorPanel", () => {
  it("renders a bounded fallback message when no image manipulation draft is active", () => {
    const html = renderToStaticMarkup(
      <ImageManipulationRuntimeEditorPanel
        context={{
          studioId: "system-studio",
          snapshot: undefined,
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        }}
      />,
    );

    expect(html).toContain("runtime page is unavailable");
  });

  it("renders the editor layout with preview and gallery regions for template drafts", () => {
    const html = renderToStaticMarkup(
      <ImageManipulationRuntimeEditorPanel
        context={{
          studioId: "system-studio",
          snapshot: {
            studioId: "system-studio",
            studioName: "System Studio",
            activeSessionId: "session-1",
            sessionStatus: "active",
            draft: {
              draftId: "draft-1",
              assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
              content: "{}",
              revision: 1,
              lifecycleStatus: "draft",
              metadata: {
                title: "Reference image system",
                tags: [],
              },
              dependencies: [],
              publishedVersionIds: [],
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
            },
            versions: [],
            validationIssues: [],
          },
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        } as never}
      />,
    );

    expect(html).toContain("Image preview");
    expect(html).toContain("Image browser");
    expect(html).toContain("Selected photos");
    expect(html).toContain("Create image");
    expect(html).toContain("Status: Ready");
    expect(html).toContain("Settings ready");
    expect(html).toContain("Choose a source photo first");
    expect(html).toContain("Advanced details");
    expect(html).toContain("Results (0)");
    expect(html).toContain("Source (0)");
    expect(html).toContain("Face reference (0)");
    expect(html).toContain("disabled=\"\"");
  });
});

