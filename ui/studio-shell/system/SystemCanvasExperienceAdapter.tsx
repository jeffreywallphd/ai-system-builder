import type { JSX } from "react";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
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

export interface SystemCanvasExperienceContext {
  readonly extensionContext: StudioShellExtensionContext;
  readonly document: SystemStudioDraftDocument;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
}

export interface SystemCanvasExperienceAdapterInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedInspectorPanel: SystemCanvasInspectorPanelId;
  readonly onSelectInspectorPanel: (panelId: SystemCanvasInspectorPanelId) => void;
}

function toIssueSummaries(issues: ReadonlyArray<StudioShellValidationIssue>): ReadonlyArray<ExperienceIssueSummary> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    id: `${issue.code}:${issue.path ?? ""}:${issue.message}`,
    message: issue.message,
  })));
}

function resolveFocusedTarget(context: SystemCanvasExperienceContext): CanvasSurfaceFocusedTarget {
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

export function createSystemCanvasExperienceDefinition(
  input: SystemCanvasExperienceAdapterInput,
): {
  readonly definition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext>;
  readonly context: SystemCanvasExperienceContext;
} {
  const context: SystemCanvasExperienceContext = Object.freeze({
    extensionContext: input.extensionContext,
    document: parseSystemStudioDraftDocument(input.content),
    issues: toIssueSummaries(input.validationIssues),
    selectedInspectorPanel: input.selectedInspectorPanel,
  });

  const definition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext> = Object.freeze({
    identity: Object.freeze({
      id: "system-canvas",
      title: "System Canvas",
      summary: "Compose systems from reusable assets and bindings.",
    }),
    resolveGraphSummary,
    resolveFocusedTarget,
    resolvePalette: () => Object.freeze({
      title: "Compose",
      description: "Use the component composer as the main system canvas surface.",
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
