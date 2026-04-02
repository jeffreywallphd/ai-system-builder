import type { JSX } from "react";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceEditingEvent,
  CanvasSurfaceEditingModel,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceLayoutNodeModel,
} from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { ExperienceIssueSummary } from "../experience-assets/ExperiencePresentationVocabulary";
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

export interface SystemCanvasNodeLayoutFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SystemCanvasExperienceContext {
  readonly extensionContext: StudioShellExtensionContext;
  readonly document: SystemStudioDraftDocument;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
  readonly selectedLayoutNodeId?: string;
  readonly layoutNodes: ReadonlyArray<CanvasSurfaceLayoutNodeModel>;
}

export interface SystemCanvasExperienceAdapterInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
  readonly onSelectInspectorPanel: (panelId: SystemCanvasInspectorPanelId) => void;
  readonly selectedLayoutNodeId?: string;
  readonly layoutFramesByNodeId?: Readonly<Record<string, SystemCanvasNodeLayoutFrame>>;
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
  readonly layoutFramesByNodeId?: Readonly<Record<string, SystemCanvasNodeLayoutFrame>>;
}): ReadonlyArray<CanvasSurfaceLayoutNodeModel> {
  const columns = 3;
  return Object.freeze(input.document.systemSpec.components.map((component, index) => {
    const alias = component.alias?.trim() || `${component.componentKind} ${index + 1}`;
    const nodeId = component.alias?.trim() || `${component.assetId}:${index}`;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const defaultFrame = Object.freeze({
      x: 40 + (col * 280),
      y: 56 + (row * 186),
      width: 240,
      height: 140,
    });
    const frame = input.layoutFramesByNodeId?.[nodeId] ?? defaultFrame;

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

function resolveEditingModel(context: SystemCanvasExperienceContext): CanvasSurfaceEditingModel {
  return Object.freeze({
    nodes: context.layoutNodes,
    selectedNodeId: context.selectedLayoutNodeId,
    commands: Object.freeze([
      Object.freeze({ id: "fit-layout", label: "Reset layout", tone: "ghost" as const }),
    ]),
    createNodeDescription: "Double-click to stage a new block. Add details with the composer below.",
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
    layoutFramesByNodeId: input.layoutFramesByNodeId,
  });

  const context: SystemCanvasExperienceContext = Object.freeze({
    extensionContext: input.extensionContext,
    document,
    issues: toIssueSummaries(input.validationIssues),
    selectedInspectorPanel: input.selectedInspectorPanel,
    selectedLayoutNodeId: input.selectedLayoutNodeId,
    layoutNodes,
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
    resolveInteractionMessage: (canvasContext) => `Bindings configured: ${canvasContext.document.systemSpec.bindings.length}`,
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
