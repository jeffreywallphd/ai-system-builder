import type { JSX } from "react";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceEditingEvent,
  CanvasSurfaceEditingModel,
  CanvasSurfaceDesignFrameModel,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceLayoutNodeModel,
} from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { ExperienceIssueSummary } from "../experience-assets/ExperiencePresentationVocabulary";
import {
  mapLayoutNodeToPanelAsset,
  mapPanelAssetToRuntimeInstance,
  type PanelAssetContract,
} from "../experience-assets/PanelAssetContracts";
import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import {
  parseSystemStudioDraftDocument,
  type SystemStudioDraftDocument,
  type SystemStudioPageDefinition,
} from "./SystemStudioDraftDocument";
import { systemPageLayoutTemplates } from "./SystemPageModel";
import { SystemCompositionEditor } from "../../components/studio-shell/SystemCompositionEditor";
import { SystemInterfaceEditor } from "../../components/studio-shell/SystemInterfaceEditor";
import { SystemParameterConfigEditor } from "../../components/studio-shell/SystemParameterConfigEditor";

export const SystemCanvasInspectorPanels = Object.freeze({
  interfaces: "interfaces",
  parameters: "parameters",
});

export type SystemCanvasInspectorPanelId =
  typeof SystemCanvasInspectorPanels[keyof typeof SystemCanvasInspectorPanels];

export interface SystemCanvasExperienceContext {
  readonly extensionContext: StudioShellExtensionContext;
  readonly document: SystemStudioDraftDocument;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
  readonly selectedLayoutNodeId?: string;
  readonly selectedPageId: string;
  readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
  readonly layoutNodes: ReadonlyArray<CanvasSurfaceLayoutNodeModel>;
  readonly designFrame: CanvasSurfaceDesignFrameModel;
  readonly panels: ReadonlyArray<PanelAssetContract>;
}

export interface SystemCanvasExperienceAdapterInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
  readonly onSelectInspectorPanel: (panelId: SystemCanvasInspectorPanelId) => void;
  readonly selectedLayoutNodeId?: string;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onCanvasEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
}

function toIssueSummaries(issues: ReadonlyArray<StudioShellValidationIssue>): ReadonlyArray<ExperienceIssueSummary> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    id: `${issue.code}:${issue.path ?? ""}:${issue.message}`,
    message: issue.message,
  })));
}

function resolveFocusedTarget(context: SystemCanvasExperienceContext): CanvasSurfaceFocusedTarget {
  if (context.selectedLayoutNodeId) {
    const selected = context.layoutNodes.find((node) => node.id === context.selectedLayoutNodeId);
    if (selected) {
      return Object.freeze({ kind: "node", id: selected.id, label: selected.title });
    }
  }

  return Object.freeze({
    kind: "node",
    id: context.selectedPageId,
    label: context.pages.find((page) => page.pageId === context.selectedPageId)?.title ?? "Page",
  });
}

function resolveGraphSummary(context: SystemCanvasExperienceContext): CanvasSurfaceGraphSummary {
  return Object.freeze({
    nodeCount: context.layoutNodes.length,
    edgeCount: 0,
    issueCount: context.issues.length,
  });
}

function renderInspector(context: SystemCanvasExperienceContext): JSX.Element {
  if (context.selectedInspectorPanel === SystemCanvasInspectorPanels.interfaces) {
    return <SystemInterfaceEditor context={context.extensionContext} />;
  }
  return <SystemParameterConfigEditor context={context.extensionContext} />;
}

function resolvePanelsForPage(input: {
  readonly document: SystemStudioDraftDocument;
  readonly selectedPageId: string;
}): ReadonlyArray<PanelAssetContract> {
  const pageLayout = input.document.canvasAuthoring.pageLayouts.find((entry) => entry.pageId === input.selectedPageId);
  return pageLayout?.panels ?? Object.freeze([]);
}

function resolveLayoutNodes(input: {
  readonly panels: ReadonlyArray<PanelAssetContract>;
}): ReadonlyArray<CanvasSurfaceLayoutNodeModel> {
  return Object.freeze(input.panels.map((panel) => Object.freeze({
    id: panel.sourceLayoutNodeId ?? panel.panelId,
    title: panel.title,
    subtitle: panel.description ?? "High-level section",
    x: panel.layoutBounds.x,
    y: panel.layoutBounds.y,
    width: panel.layoutBounds.width,
    height: panel.layoutBounds.height,
    minWidth: 140,
    minHeight: 96,
    selectable: true,
    movable: true,
    resizable: true,
  })));
}

function resolveEditingModel(context: SystemCanvasExperienceContext): CanvasSurfaceEditingModel {
  return Object.freeze({
    nodes: context.layoutNodes,
    selectedNodeId: context.selectedLayoutNodeId,
    commands: Object.freeze([
      Object.freeze({ id: "add-panel", label: "Add page section", tone: "primary" as const }),
      Object.freeze({
        id: "remove-panel",
        label: "Remove selected section",
        tone: "ghost" as const,
        disabled: !context.selectedLayoutNodeId,
      }),
      Object.freeze({ id: "fit-layout", label: "Clear page layout", tone: "ghost" as const }),
    ]),
    createNodeDescription: "Double-click to add a major page section. Drag or resize to shape page structure.",
    designFrame: context.designFrame,
    coordinateSpace: Object.freeze({
      mode: "normalized",
      referenceDimensions: context.designFrame.dimensions ?? Object.freeze({ width: 1600, height: 900 }),
    }),
  });
}

export function createSystemCanvasExperienceDefinition(
  input: SystemCanvasExperienceAdapterInput,
): {
  readonly definition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext>;
  readonly context: SystemCanvasExperienceContext;
} {
  const document = parseSystemStudioDraftDocument(input.content);
  const pages = document.systemSpec.pages;
  const selectedPageId = pages.some((page) => page.pageId === input.selectedPageId)
    ? input.selectedPageId
    : pages[0]?.pageId ?? "page-1";
  const panels = resolvePanelsForPage({ document, selectedPageId });
  const layoutNodes = resolveLayoutNodes({ panels });
  const runtimePanels = Object.freeze(panels.map((panel) => mapPanelAssetToRuntimeInstance(panel)));

  const context: SystemCanvasExperienceContext = Object.freeze({
    extensionContext: input.extensionContext,
    document,
    issues: toIssueSummaries(input.validationIssues),
    selectedInspectorPanel: input.selectedInspectorPanel,
    selectedLayoutNodeId: input.selectedLayoutNodeId,
    selectedPageId,
    pages,
    layoutNodes,
    designFrame: document.canvasAuthoring.designFrame,
    panels,
  });

  const definition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext> = Object.freeze({
    identity: Object.freeze({
      id: "system-canvas",
      title: "Page structure",
      summary: "Arrange major page sections and panel regions.",
    }),
    resolveGraphSummary,
    resolveFocusedTarget,
    resolveEditingModel,
    onEditingEvent: ({ event }) => {
      input.onCanvasEditingEvent?.(event);
    },
    resolvePalette: () => Object.freeze({
      title: "Page",
      description: "Choose which page you want to design.",
    }),
    resolveIssues: (canvasContext) => canvasContext.issues,
    renderGraphInteractionShell: ({ context: canvasContext }) => (
      <SystemCompositionEditor context={canvasContext.extensionContext} />
    ),
    renderPaletteRegion: () => (
      <div className="ui-stack ui-stack--2xs" data-testid="system-canvas-page-picker">
        <p className="ui-text-small ui-text-secondary">
          Build the high-level page structure here. Detailed panel content is authored inside each panel's own studio.
        </p>
        <div className="ui-row ui-row--wrap">
          {pages.map((page) => (
            <button
              key={page.pageId}
              type="button"
              className={`ui-button ui-button--sm ${page.pageId === selectedPageId ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => input.onSelectPage(page.pageId)}
            >
              {page.title}
            </button>
          ))}
        </div>
        <div className="ui-row ui-row--wrap">
          {(pages.find((page) => page.pageId === selectedPageId)?.layout.regionIds ?? []).map((regionId) => (
            <span key={regionId} className="ui-badge ui-badge--neutral">
              {regionId}
            </span>
          ))}
        </div>
        <span className="ui-text-small ui-text-secondary">
          {systemPageLayoutTemplates.find(
            (template) => template.layoutKind === pages.find((page) => page.pageId === selectedPageId)?.layout.layoutKind,
          )?.summary ?? "Select a page to view layout regions."}
        </span>
        <div className="ui-row ui-row--wrap" data-testid="system-canvas-palette-actions">
          <button
            type="button"
            className={`ui-button ui-button--sm ${input.selectedInspectorPanel === SystemCanvasInspectorPanels.interfaces ? "ui-button--primary" : "ui-button--ghost"}`}
            onClick={() => input.onSelectInspectorPanel(SystemCanvasInspectorPanels.interfaces)}
          >
            Inputs & outputs
          </button>
          <button
            type="button"
            className={`ui-button ui-button--sm ${input.selectedInspectorPanel === SystemCanvasInspectorPanels.parameters ? "ui-button--primary" : "ui-button--ghost"}`}
            onClick={() => input.onSelectInspectorPanel(SystemCanvasInspectorPanels.parameters)}
          >
            Settings
          </button>
        </div>
      </div>
    ),
    renderInspectorRegion: ({ context: canvasContext }) => renderInspector(canvasContext),
    renderSupplementaryPanels: ({ extensionContext }) => (
      <SystemCompositionEditor context={extensionContext} />
    ),
    resolveInteractionMessage: (canvasContext) => `Sections on this page: ${canvasContext.layoutNodes.length} · Panel internals are designed separately`,
    emptyState: Object.freeze({
      when: (canvasContext) => canvasContext.layoutNodes.length === 0,
      render: () => (
        <div className="ui-card ui-card--padded" data-testid="system-canvas-empty-state">
          <strong>Add your first major section</strong>
          <p className="ui-text-small ui-text-secondary">
            Start with high-level structure only. You can design section internals later in panel studios.
          </p>
        </div>
      ),
    }),
  });

  return Object.freeze({ definition, context });
}

export function createSystemPanelFromCanvasNode(input: {
  readonly node: CanvasSurfaceLayoutNodeModel;
  readonly pageId: string;
}): PanelAssetContract {
  return mapLayoutNodeToPanelAsset({
    node: input.node,
    pageId: input.pageId,
    contentSlots: Object.freeze([
      Object.freeze({
        slotId: `${input.node.id}-content`,
        label: "Panel region",
      }),
    ]),
  });
}
