import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "../../../application/system-studio/ImageManipulationSystemTemplate";
import { createImageManipulationRuntimeWindowLaunchContract } from "../../../application/system-runtime/SystemRuntimeWindowLaunchResolver";
import { SystemRuntimeWindowHydrationService } from "../SystemRuntimeWindowHydrationService";

describe("SystemRuntimeWindowHydrationService", () => {
  it("hydrates runtime state from launch contract and studio draft content", () => {
    const service = new SystemRuntimeWindowHydrationService();
    const launchContract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-1",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
      initialSelection: {
        activePreviewRole: "reference",
        selectedRecordIds: {
          "reference-image-dataset": "record-reference-1",
        },
      },
    });

    const result = service.hydrate({
      launchContract,
      snapshot: {
        studioId: "system-studio",
        studioName: "System Studio",
        activeSessionId: "session-1",
        sessionStatus: "active",
        draft: {
          draftId: "draft-1",
          assetId: ImageManipulationSystemTemplate.systemAsset.assetId,
          content: JSON.stringify({
            systemSpec: {
              components: [],
              nestedSystems: [],
              dependencies: [],
              inputs: [],
              outputs: [],
              parameters: [],
              bindings: [],
              executionMetadata: {
                runtime: {
                  environment: "comfyui",
                },
              },
              pages: [
                {
                  pageId: "page-main",
                  title: "Main page",
                  layout: {
                    layoutKind: "workspace",
                    defaultRegionId: "workspace",
                    regionIds: ["workspace"],
                  },
                  navigation: {
                    route: "/",
                    title: "Main",
                    supportsDeepLinking: false,
                    requiresRuntimeSession: false,
                  },
                },
              ],
              canvasAuthoring: {
                pageLayouts: [
                  {
                    pageId: "page-main",
                    panels: [
                      {
                        panelId: "panel-1",
                        assetId: "ui-composed:panel",
                        panelType: "composed-panel",
                        pageId: "page-main",
                        title: "Editor",
                        contentSlots: [{ slotId: "panel-content" }],
                        content: {
                          kind: "embedded-studio",
                          studioAssetId: launchContract.launchTarget.pageBindingId,
                        },
                      },
                    ],
                  },
                ],
              },
              serialization: {
                contractKind: "ai-loom.system-serialization",
                schemaVersion: "1.0.0",
                compatibility: {
                  minimumReaderVersion: "1.0.0",
                  legacySystemSpecSupported: true,
                },
                definition: {
                  components: [],
                  nestedSystems: [],
                  dependencies: [],
                  inputs: [],
                  outputs: [],
                  parameters: [],
                  bindings: [],
                  executionMetadata: {
                    runtime: {
                      environment: "comfyui",
                    },
                  },
                },
                assetReferences: {
                  datasets: [],
                  workflows: [],
                },
                runtime: {
                  datasetInstances: [],
                  workflowBindings: [
                    {
                      bindingId: "workflow-binding:1",
                      workflowAssetId: "asset:workflow:runtime-template",
                      workflowVersionId: "asset:workflow:runtime-template:v1",
                      pinMode: "version",
                    },
                  ],
                  state: {
                    selection: {
                      activePreviewRole: "reference",
                      selectedDatasetBindingId: "reference-image-dataset",
                      selectedRecordIds: {
                        "reference-image-dataset": "record-reference-1",
                      },
                    },
                  },
                },
                ui: {},
              },
            },
          }),
          revision: 1,
          lifecycleStatus: "draft",
          metadata: {
            title: "Image manipulation system",
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
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state?.resolvedSystemAsset.assetId).toBe(ImageManipulationSystemTemplate.systemAsset.assetId);
    expect(result.state?.resolvedWorkflowTemplate.workflowTemplateAssetId).toBe("asset:workflow:runtime-template");
    expect(result.state?.resolvedPage.pageId).toBe("page-main");
    expect(result.state?.datasetBindings.map((entry) => entry.bindingId)).toEqual([
      "input-image-dataset",
      "output-image-dataset",
      "reference-image-dataset",
    ]);
    expect(result.state?.initialSelection.activePreviewRole).toBe("reference");
    expect(result.state?.initialSelection.selectedRecordIds["reference-image-dataset"]).toBe("record-reference-1");
  });

  it("returns normalized hydration errors when launch data is missing", () => {
    const service = new SystemRuntimeWindowHydrationService();
    const result = service.hydrate({});

    expect(result.ok).toBe(false);
    expect(result.state).toBeUndefined();
    expect(result.issues[0]?.code).toBe("runtime-window.launch-contract.missing");
    expect(result.issues[0]?.severity).toBe("error");
  });
});

