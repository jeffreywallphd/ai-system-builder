import type { JSX } from "react";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceIdentity,
  CanvasSurfacePaletteModel,
} from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { ExperienceIssueSummary } from "../experience-assets/ExperiencePresentationVocabulary";
import type {
  WorkflowCanvasGraphNodeViewModel,
  WorkflowCanvasViewModel,
} from "./WorkflowStudioCanvasViewModel";

export interface WorkflowCanvasExperienceContext {
  readonly viewModel: WorkflowCanvasViewModel;
  readonly selectedNode?: WorkflowCanvasGraphNodeViewModel;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly interactionMessage?: string;
  readonly renderGraphInteractionShell: () => JSX.Element;
  readonly renderPaletteRegion: () => JSX.Element;
  readonly renderInspectorRegion: () => JSX.Element;
  readonly renderSupplementaryPanels: () => JSX.Element;
}

const workflowCanvasIdentity: CanvasSurfaceIdentity = Object.freeze({
  id: "workflow-canvas",
  title: "Workflow Canvas",
  summary: "Graph-oriented workflow authoring.",
});

const workflowCanvasPalette: CanvasSurfacePaletteModel = Object.freeze({
  title: "Nodes",
  description: "Search and add workflow nodes.",
});

function resolveFocusedTarget(
  context: WorkflowCanvasExperienceContext,
): CanvasSurfaceFocusedTarget {
  if (!context.selectedNode) {
    return Object.freeze({ kind: "none" });
  }

  return Object.freeze({
    kind: "node",
    id: context.selectedNode.id,
    label: context.selectedNode.title,
  });
}

function resolveGraphSummary(
  context: WorkflowCanvasExperienceContext,
): CanvasSurfaceGraphSummary {
  return Object.freeze({
    nodeCount: context.viewModel.graph.nodes.length,
    edgeCount: context.viewModel.graph.edges.length,
    issueCount: context.viewModel.totalIssueCount,
  });
}

export const workflowCanvasExperienceDefinition: CanvasExperienceAssetDefinition<WorkflowCanvasExperienceContext> = Object.freeze({
  identity: workflowCanvasIdentity,
  resolveGraphSummary,
  resolveFocusedTarget,
  resolvePalette: () => workflowCanvasPalette,
  resolveIssues: (context) => context.issues,
  renderGraphInteractionShell: ({ context }) => context.renderGraphInteractionShell(),
  renderPaletteRegion: (context) => context.renderPaletteRegion(),
  renderInspectorRegion: ({ context }) => context.renderInspectorRegion(),
  renderSupplementaryPanels: (context) => context.renderSupplementaryPanels(),
  resolveInteractionMessage: (context) => context.interactionMessage,
  emptyState: Object.freeze({
    when: (context) => context.viewModel.totalNodeCount === 0,
    render: () => (
      <div className="ui-card ui-card--padded ui-workflow-canvas-empty-state" data-testid="workflow-canvas-empty-state">
        <strong>Canvas is empty</strong>
        <p className="ui-text-small ui-text-secondary">
          Add trigger, input, step, and output nodes from the Nodes drawer to start authoring this workflow.
        </p>
      </div>
    ),
  }),
});
