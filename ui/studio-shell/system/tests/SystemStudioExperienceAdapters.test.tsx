import { describe, expect, it } from "bun:test";
import { createSystemCanvasExperienceDefinition } from "../SystemCanvasExperienceAdapter";
import { createSystemWizardExperienceAdapterModel, SystemWizardPageIds } from "../SystemWizardExperienceAdapter";
import type { StudioShellExtensionContext } from "../../StudioShellExtensions";

const extensionContext: StudioShellExtensionContext = Object.freeze({
  studioId: "studio-systems",
  snapshot: undefined,
  validationIssues: Object.freeze([]),
  handoffContext: Object.freeze({}),
  isBusy: false,
  operations: Object.freeze({
    refresh: async () => undefined,
  }),
});

describe("System studio experience adapters", () => {
  const buildCanvasModel = (content: string) => createSystemCanvasExperienceDefinition({
    content,
    extensionContext,
    validationIssues: [],
    selectedInspectorPanel: "interfaces",
    onSelectInspectorPanel: () => undefined,
    selectedPageId: "page-1",
    onSelectPage: () => undefined,
  });

  it("maps selected page layout panels into the reusable canvas editing model", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [
          { pageId: "page-1", heading: "Welcome" },
          { pageId: "page-2", heading: "Summary" },
        ],
        canvasAuthoring: {
          designFrame: {
            mode: "bounded-frame",
            ratio: { width: 16, height: 9 },
            dimensions: { width: 1600, height: 900 },
          },
          pageLayouts: [
            {
              pageId: "page-2",
              panels: [
                {
                  panelId: "panel-1",
                  pageId: "page-2",
                  title: "Main panel",
                  layoutBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                  contentSlots: [],
                  sourceLayoutNodeId: "panel-1",
                },
              ],
            },
          ],
        },
      },
    });

    const model = createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues: [],
      selectedInspectorPanel: "interfaces",
      onSelectInspectorPanel: () => undefined,
      selectedPageId: "page-2",
      onSelectPage: () => undefined,
    });

    const editing = model.definition.resolveEditingModel?.(model.context);
    expect(editing?.nodes).toHaveLength(1);
    expect(editing?.nodes[0]?.title).toBe("Main panel");
    expect(editing?.commands?.map((command) => command.id)).toEqual(["add-panel", "remove-panel", "fit-layout"]);
  });

  it("starts wizard flow with multi-page setup", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [
          { pageId: "page-1", heading: "Welcome" },
        ],
      },
    });

    const canvasModel = buildCanvasModel(content);
    const model = createSystemWizardExperienceAdapterModel({
      content,
      extensionContext,
      validationIssues: [],
      selectedPageId: "page-1",
      onSelectPage: () => undefined,
      onPagesChange: () => undefined,
      canvasDefinition: canvasModel.definition,
      canvasContext: canvasModel.context,
      embeddedDatasetContent: "",
      embeddedDatasetExtensionContext: extensionContext,
      embeddedWorkflowContent: "",
      embeddedWorkflowExtensionContext: extensionContext,
    });

    expect(model.definition.pages[0]?.id).toBe(SystemWizardPageIds.pages);
    expect(model.definition.pages[1]?.id).toBe(SystemWizardPageIds.interfaceDesign);
    expect(model.definition.pages[2]?.id).toBe(SystemWizardPageIds.inputsOutputs);
    expect(model.definition.pages[3]?.id).toBe(SystemWizardPageIds.behaviorAutomation);
    expect(model.definition.pages[4]?.id).toBe(SystemWizardPageIds.settings);
    const progress = model.definition.resolveProgress({ context: model.context, activePageId: SystemWizardPageIds.pages });
    expect(progress.totalCount).toBe(5);
  });

  it("marks Inputs & Outputs step ready when embedded data setup has authored content", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [{ pageId: "page-1", heading: "Welcome" }],
      },
    });
    const canvasModel = buildCanvasModel(content);
    const model = createSystemWizardExperienceAdapterModel({
      content,
      extensionContext,
      validationIssues: [],
      selectedPageId: "page-1",
      onSelectPage: () => undefined,
      onPagesChange: () => undefined,
      canvasDefinition: canvasModel.definition,
      canvasContext: canvasModel.context,
      embeddedDatasetContent: "{\"stages\":[{\"stageId\":\"load\"}]}",
      embeddedDatasetExtensionContext: extensionContext,
      embeddedWorkflowContent: "",
      embeddedWorkflowExtensionContext: extensionContext,
    });

    const inputsOutputsPage = model.definition.pages.find((page) => page.id === SystemWizardPageIds.inputsOutputs);
    expect(inputsOutputsPage?.resolveStatus?.(model.context)).toBe("ready");
  });
});
