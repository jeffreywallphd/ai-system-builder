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
import { parseSystemStudioDraftDocument, type SystemStudioDraftDocument } from "./SystemStudioDraftDocument";
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
      return Object.freeze({
        kind: "node",
        id: selected.id,
        label: selected.title,
      });
    }
  }

  return Object.freeze({
    kind: "node",
    id: "system-composition",
    label: `Components (${context.document.systemSpec.components.length})`,
  });
}

function resolveGraphSummary(context: SystemCanvasExperienceContext): CanvasSurfaceGraphSummary {
  return Object.freeze({
    nodeCount: context.document.systemSpec.components.length,
    edgeCount: context.document.systemSpec.bindings.length,
    issueCount: context.issues.length,
  });
}

function renderInspector(context: SystemCanvasExperienceContext): JSX.Element {
  if (context.selectedInspectorPanel === SystemCanvasInspectorPanels.interfaces) {
    return <SystemInterfaceEditor context={context.extensionContext} />;
  }
  return <SystemParameterConfigEditor context={context.extensionContext} />;
}

function resolveLayoutNodes(input: {
  readonly document: SystemStudioDraftDocument;
}): ReadonlyArray<CanvasSurfaceLayoutNodeModel> {
  const columns = 3;
  return Object.freeze(input.document.systemSpec.components.map((component, index) => {
    const alias = component.alias?.trim() || `${component.componentKind} ${index + 1}`;
    const nodeId = component.alias?.trim() || `${component.assetId}:${index}`;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const defaultFrame = Object.freeze({
      x: 0.03 + (col * 0.31),
      y: 0.06 + (row * 0.24),
      width: 0.27,
      height: 0.2,
    });
    const persistedPanel = input.document.canvasAuthoring.panels.find((panel) => panel.sourceLayoutNodeId === nodeId);
    const frame = persistedPanel?.layoutBounds ?? defaultFrame;

    return Object.freeze({
      id: nodeId,
      title: alias,
      subtitle: component.assetId,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      minWidth: 180,
      minHeight: 112,
      selectable: true,
      movable: true,
      resizable: true,
    });
  }));
}

function resolvePanels(input: {
  readonly document: SystemStudioDraftDocument;
  readonly nodes: ReadonlyArray<CanvasSurfaceLayoutNodeModel>;
}): ReadonlyArray<PanelAssetContract> {
  if (input.document.canvasAuthoring.panels.length > 0) {
    return input.document.canvasAuthoring.panels;
  }
  return Object.freeze(input.nodes.map((node) => mapLayoutNodeToPanelAsset({
    node,
    pageId: "system-canvas",
    contentSlots: Object.freeze([
      Object.freeze({
        slotId: `${node.id}-content`,
        label: "Main content",
      }),
    ]),
  })));
}

function resolveEditingModel(context: SystemCanvasExperienceContext): CanvasSurfaceEditingModel {
  return Object.freeze({
    nodes: context.layoutNodes,
    selectedNodeId: context.selectedLayoutNodeId,
    commands: Object.freeze([
      Object.freeze({ id: "fit-layout", label: "Reset layout", tone: "ghost" as const }),
    ]),
    createNodeDescription: "Double-click to stage a new block. Add details with the composer below.",
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
  const layoutNodes = resolveLayoutNodes({
    document,
  });
  const panels = resolvePanels({ document, nodes: layoutNodes });
  const runtimePanels = Object.freeze(panels.map((panel) => mapPanelAssetToRuntimeInstance(panel)));

  const context: SystemCanvasExperienceContext = Object.freeze({
    extensionContext: input.extensionContext,
    document,
    issues: toIssueSummaries(input.validationIssues),
    selectedInspectorPanel: input.selectedInspectorPanel,
    selectedLayoutNodeId: input.selectedLayoutNodeId,
    layoutNodes,
    designFrame: document.canvasAuthoring.designFrame,
    panels,
  });

  const definition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext> = Object.freeze({
    identity: Object.freeze({
      id: "system-canvas",
      title: "System canvas",
      summary: "Arrange reusable components and tune how they connect.",
    }),
    resolveGraphSummary,
    resolveFocusedTarget,
    resolveEditingModel,
    onEditingEvent: ({ event }) => {
      input.onCanvasEditingEvent?.(event);
    },
    resolvePalette: () => Object.freeze({
      title: "Builder",
      description: "Use these tools to edit structure details.",
    }),
    resolveIssues: (canvasContext) => canvasContext.issues,
    renderGraphInteractionShell: ({ context: canvasContext }) => (
      <SystemCompositionEditor context={canvasContext.extensionContext} />
    ),
    renderPaletteRegion: () => (
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
    ),
    renderInspectorRegion: ({ context: canvasContext }) => renderInspector(canvasContext),
    renderSupplementaryPanels: ({ extensionContext }) => (
      <SystemCompositionEditor context={extensionContext} />
    ),
    resolveInteractionMessage: (canvasContext) => `Bindings configured: ${canvasContext.document.systemSpec.bindings.length} · Panels ready for runtime: ${runtimePanels.length}`,
    emptyState: Object.freeze({
      when: (canvasContext) => canvasContext.document.systemSpec.components.length === 0,
      render: () => (
        <div className="ui-card ui-card--padded" data-testid="system-canvas-empty-state">
          <strong>Add your first component</strong>
          <p className="ui-text-small ui-text-secondary">
            Start with a model, workflow, or nested system to build this composition.
          </p>
        </div>
      ),
    }),
  });

  return Object.freeze({ definition, context });
}
