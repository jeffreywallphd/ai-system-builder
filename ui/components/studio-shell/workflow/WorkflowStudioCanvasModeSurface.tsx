import { useEffect, useMemo, useState } from "react";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftInputSourceTypes,
  type WorkflowDraft,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  WorkflowCanvasGraphNodeKinds,
  WorkflowCanvasSectionIds,
  type WorkflowCanvasAction,
  type WorkflowCanvasGraphNodeViewModel,
  type WorkflowCanvasSectionId,
} from "../../../studio-shell/workflow/WorkflowStudioCanvasViewModel";
import WorkflowStudioCanvasReactFlow from "./WorkflowStudioCanvasReactFlow";
import {
  setWorkflowTriggerStateConfig,
  setWorkflowTriggerTitle,
  setWorkflowTriggerType,
  workflowTriggerTypeDefinitions,
} from "../../../studio-shell/workflow/WorkflowWizardTriggers";
import {
  buildWorkflowStepTypeDefinitionKey,
  setWorkflowStepIfThenConfig,
  setWorkflowStepTitle,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
} from "../../../studio-shell/workflow/WorkflowWizardSteps";
import {
  setWorkflowOutputDestinationType,
  setWorkflowOutputTitle,
  workflowOutputTypeDefinitions,
} from "../../../studio-shell/workflow/WorkflowWizardOutputs";

export interface WorkflowStudioCanvasModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly draftEditorContent: string;
  readonly onChangeDraftEditorContent: (nextContent: string) => void;
  readonly drawerState?: {
    readonly left?: {
      readonly label: string;
      readonly isOpen: boolean;
      readonly onClose?: () => void;
    };
    readonly right?: {
      readonly label: string;
      readonly isOpen: boolean;
    };
  };
}

interface WorkflowCanvasPaletteOption {
  readonly id: string;
  readonly sectionId: WorkflowCanvasSectionId;
  readonly title: string;
  readonly summary: string;
  readonly action: WorkflowCanvasAction;
}

interface WorkflowCanvasPaletteSection {
  readonly id: WorkflowCanvasSectionId;
  readonly title: string;
  readonly description: string;
}

const workflowCanvasPaletteSections: ReadonlyArray<WorkflowCanvasPaletteSection> = Object.freeze([
  Object.freeze({
    id: WorkflowCanvasSectionIds.triggers,
    title: "Trigger nodes",
    description: "Start conditions and incoming events.",
  }),
  Object.freeze({
    id: WorkflowCanvasSectionIds.inputs,
    title: "Input nodes",
    description: "Runtime, dataset, and static data inputs.",
  }),
  Object.freeze({
    id: WorkflowCanvasSectionIds.steps,
    title: "Step nodes",
    description: "Action and built-in execution steps.",
  }),
  Object.freeze({
    id: WorkflowCanvasSectionIds.outputs,
    title: "Output nodes",
    description: "Workflow result destinations.",
  }),
]);

function buildPaletteOptions(): ReadonlyArray<WorkflowCanvasPaletteOption> {
  return Object.freeze([
    ...workflowTriggerTypeDefinitions.map((definition) => Object.freeze({
      id: `trigger:${definition.type}`,
      sectionId: WorkflowCanvasSectionIds.triggers,
      title: definition.label,
      summary: definition.description,
      action: Object.freeze({ kind: "add-trigger", triggerType: definition.type } satisfies WorkflowCanvasAction),
    })),
    Object.freeze({
      id: "input:dataset",
      sectionId: WorkflowCanvasSectionIds.inputs,
      title: "Dataset asset",
      summary: "Dataset-backed input.",
      action: Object.freeze({ kind: "add-input-dataset-asset" } satisfies WorkflowCanvasAction),
    }),
    Object.freeze({
      id: "input:runtime",
      sectionId: WorkflowCanvasSectionIds.inputs,
      title: "Runtime parameter",
      summary: "Runtime-provided input.",
      action: Object.freeze({ kind: "add-input-runtime-parameter" } satisfies WorkflowCanvasAction),
    }),
    Object.freeze({
      id: "input:static",
      sectionId: WorkflowCanvasSectionIds.inputs,
      title: "Static value",
      summary: "Inline literal input.",
      action: Object.freeze({ kind: "add-input-static-value" } satisfies WorkflowCanvasAction),
    }),
    ...workflowStepTypeDefinitions.filter((definition) => definition.interactive).map((definition) => Object.freeze({
      id: `step:${definition.type}`,
      sectionId: WorkflowCanvasSectionIds.steps,
      title: definition.label,
      summary: definition.summary,
      action: Object.freeze({
        kind: "add-step",
        definitionKey: buildWorkflowStepTypeDefinitionKey(definition),
      } satisfies WorkflowCanvasAction),
    })),
    ...workflowOutputTypeDefinitions.map((definition) => Object.freeze({
      id: `output:${definition.destinationType}`,
      sectionId: WorkflowCanvasSectionIds.outputs,
      title: definition.label,
      summary: definition.description,
      action: Object.freeze({ kind: "add-output", destinationType: definition.destinationType } satisfies WorkflowCanvasAction),
    })),
  ]);
}

export default function WorkflowStudioCanvasModeSurface({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  draftEditorContent,
  onChangeDraftEditorContent,
  drawerState,
}: WorkflowStudioCanvasModeSurfaceProps): JSX.Element {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const viewModel = useMemo(
    () => deriveWorkflowCanvasViewModel(sharedDraft, draftValidationIssues),
    [draftValidationIssues, sharedDraft],
  );
  const paletteOptions = useMemo(() => buildPaletteOptions(), []);
  const graphNodesById = useMemo(
    () => new Map(viewModel.graph.nodes.map((node) => [node.id, node])),
    [viewModel.graph.nodes],
  );
  const selectedNode = selectedNodeId ? graphNodesById.get(selectedNodeId) : undefined;
  const selectedItemNode = selectedNode?.kind === WorkflowCanvasGraphNodeKinds.item ? selectedNode : undefined;
  const leftDrawerEnabled = Boolean(drawerState?.left);
  const rightDrawerEnabled = Boolean(drawerState?.right);
  const leftDrawerOpen = drawerState?.left?.isOpen ?? true;
  const rightDrawerOpen = drawerState?.right?.isOpen ?? true;
  const normalizedPaletteSearch = paletteSearchValue.trim().toLowerCase();

  useEffect(() => {
    if (selectedNodeId && !graphNodesById.has(selectedNodeId)) {
      setSelectedNodeId(undefined);
    }
  }, [graphNodesById, selectedNodeId]);

  const updateSharedDraft = (updater: (draft: WorkflowDraft) => WorkflowDraft): void => {
    onUpdateSharedDraft?.(updater);
  };

  const applyAction = (action: WorkflowCanvasAction): void => {
    updateSharedDraft((draft) => applyWorkflowCanvasAction(draft, action).draft);
  };

  const handleRemoveNode = (node: WorkflowCanvasGraphNodeViewModel): void => {
    if (!node.entityId) {
      return;
    }
    if (node.sectionId === WorkflowCanvasSectionIds.triggers) {
      applyAction({ kind: "remove-trigger", triggerId: node.entityId });
      return;
    }
    if (node.sectionId === WorkflowCanvasSectionIds.inputs) {
      applyAction({ kind: "remove-input", inputId: node.entityId });
      return;
    }
    if (node.sectionId === WorkflowCanvasSectionIds.steps) {
      applyAction({ kind: "remove-step", stepId: node.entityId });
      return;
    }
    applyAction({ kind: "remove-output", outputId: node.entityId });
  };

  const renderNodeEditor = (node: WorkflowCanvasGraphNodeViewModel): JSX.Element | null => {
    if (node.kind !== WorkflowCanvasGraphNodeKinds.item || !node.entityId) {
      return null;
    }

    if (node.sectionId === WorkflowCanvasSectionIds.triggers) {
      const trigger = sharedDraft.triggers.find((entry) => entry.id === node.entityId);
      if (!trigger) {
        return null;
      }
      return (
        <div className="ui-stack ui-stack--2xs ui-workflow-canvas-node-form">
          <input
            className="ui-input"
            data-testid={`workflow-canvas-trigger-title-${trigger.id}`}
            value={trigger.title ?? ""}
            onChange={(event) => updateSharedDraft((draft) => setWorkflowTriggerTitle(draft, trigger.id, event.target.value).draft)}
          />
          <select
            className="ui-select"
            data-testid={`workflow-canvas-trigger-type-${trigger.id}`}
            value={trigger.type}
            onChange={(event) => updateSharedDraft((draft) => setWorkflowTriggerType(draft, trigger.id, event.target.value as typeof trigger.type).draft)}
          >
            {workflowTriggerTypeDefinitions.map((definition) => (
              <option key={`${trigger.id}-${definition.type}`} value={definition.type}>{definition.label}</option>
            ))}
          </select>
          {trigger.kind === "state" ? (
            <input
              className="ui-input"
              value={trigger.config.eventName ?? ""}
              onChange={(event) => updateSharedDraft((draft) => setWorkflowTriggerStateConfig(draft, trigger.id, {
                eventName: event.target.value.trim() || undefined,
              }).draft)}
            />
          ) : null}
        </div>
      );
    }

    if (node.sectionId === WorkflowCanvasSectionIds.inputs) {
      const input = sharedDraft.inputs.find((entry) => entry.id === node.entityId);
      if (!input) {
        return null;
      }
      return (
        <div className="ui-stack ui-stack--2xs ui-workflow-canvas-node-form">
          <input
            className="ui-input"
            data-testid={`workflow-canvas-input-title-${input.id}`}
            value={input.title ?? ""}
            onChange={(event) => applyAction({ kind: "set-input-title", inputId: input.id, title: event.target.value })}
          />
          <div className="ui-text-small ui-text-secondary">Type: {input.sourceType}</div>
          {input.sourceType === WorkflowDraftInputSourceTypes.runtimeParameter ? (
            <div className="ui-text-small ui-text-secondary">Parameter: {input.parameterKey}</div>
          ) : null}
        </div>
      );
    }

    if (node.sectionId === WorkflowCanvasSectionIds.steps) {
      const step = sharedDraft.steps.find((entry) => entry.id === node.entityId);
      if (!step) {
        return null;
      }
      const selectedDefinition = workflowStepTypeDefinitions.find((definition) => definition.type === step.type && definition.kind === step.kind)
        ?? workflowStepTypeDefinitions[0];
      return (
        <div className="ui-stack ui-stack--2xs ui-workflow-canvas-node-form">
          <input
            className="ui-input"
            data-testid={`workflow-canvas-step-title-${step.id}`}
            value={step.title ?? ""}
            onChange={(event) => updateSharedDraft((draft) => setWorkflowStepTitle(draft, step.id, event.target.value).draft)}
          />
          <select
            className="ui-select"
            data-testid={`workflow-canvas-step-type-${step.id}`}
            value={buildWorkflowStepTypeDefinitionKey(selectedDefinition)}
            onChange={(event) => updateSharedDraft((draft) => setWorkflowStepType(draft, step.id, event.target.value).draft)}
          >
            {workflowStepTypeDefinitions.filter((definition) => definition.interactive).map((definition) => (
              <option key={`${step.id}-${definition.type}`} value={buildWorkflowStepTypeDefinitionKey(definition)}>
                {definition.label}
              </option>
            ))}
          </select>
          {step.type === WorkflowDraftBuiltInStepTypes.ifThen ? (
            <input
              className="ui-input"
              value={String((step.config as { conditionExpression?: string } | undefined)?.conditionExpression ?? "")}
              onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, { conditionExpression: event.target.value }).draft)}
            />
          ) : null}
        </div>
      );
    }

    const output = sharedDraft.outputs.find((entry) => entry.id === node.entityId);
    if (!output) {
      return null;
    }
    return (
      <div className="ui-stack ui-stack--2xs ui-workflow-canvas-node-form">
        <input
          className="ui-input"
          data-testid={`workflow-canvas-output-title-${output.id}`}
          value={output.title ?? ""}
          onChange={(event) => updateSharedDraft((draft) => setWorkflowOutputTitle(draft, output.id, event.target.value).draft)}
        />
        <select
          className="ui-select"
          data-testid={`workflow-canvas-output-type-${output.id}`}
          value={output.destination.type}
          onChange={(event) => updateSharedDraft((draft) => setWorkflowOutputDestinationType(draft, output.id, event.target.value).draft)}
        >
          {workflowOutputTypeDefinitions.map((definition) => (
            <option key={`${output.id}-${definition.destinationType}`} value={definition.destinationType}>
              {definition.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const filteredPaletteOptions = useMemo(() => (
    normalizedPaletteSearch.length === 0
      ? paletteOptions
      : paletteOptions.filter((option) => {
        const section = workflowCanvasPaletteSections.find((entry) => entry.id === option.sectionId);
        const searchableContent = `${option.title} ${option.summary} ${section?.title ?? ""} ${section?.description ?? ""}`
          .toLowerCase();
        return searchableContent.includes(normalizedPaletteSearch);
      })
  ), [normalizedPaletteSearch, paletteOptions]);

  const paletteBySection = useMemo(() => {
    const grouped = new Map<string, WorkflowCanvasPaletteOption[]>();
    for (const option of filteredPaletteOptions) {
      const existing = grouped.get(option.sectionId) ?? [];
      existing.push(option);
      grouped.set(option.sectionId, existing);
    }
    return grouped;
  }, [filteredPaletteOptions]);

  const renderPalette = (): JSX.Element => (
    <section className="ui-workflow-canvas-drawer-panel ui-stack ui-stack--sm" data-testid="workflow-canvas-palette">
      <header className="ui-workflow-canvas-drawer-panel__header ui-stack ui-stack--2xs">
        <div className="ui-stack ui-stack--3xs">
          <strong>{drawerState?.left?.label ?? "Nodes"}</strong>
          <span className="ui-text-small ui-text-secondary">Search and add workflow nodes.</span>
        </div>
        {leftDrawerEnabled ? (
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            data-testid="workflow-canvas-left-drawer-close"
            onClick={() => drawerState?.left?.onClose?.()}
          >
            Close
          </button>
        ) : null}
      </header>
      <div className="ui-workflow-canvas-drawer-panel__body ui-stack ui-stack--sm">
        <label className="ui-field">
          <span className="ui-field__label">Search nodes</span>
          <input
            type="search"
            className="ui-input"
            value={paletteSearchValue}
            onChange={(event) => setPaletteSearchValue(event.target.value)}
            placeholder="Search triggers, inputs, steps, outputs"
            data-testid="workflow-canvas-palette-search"
          />
        </label>
        <div className="ui-workflow-canvas-drawer__sections ui-scrollbar">
          {workflowCanvasPaletteSections.map((section) => {
            const options = paletteBySection.get(section.id) ?? [];
            return (
              <section key={section.id} className="ui-stack ui-stack--2xs ui-workflow-canvas-drawer__section">
                <div className="ui-stack ui-stack--3xs">
                  <strong className="ui-text-small">{section.title}</strong>
                  <span className="ui-text-small ui-text-secondary">{section.description}</span>
                </div>
                {options.length === 0 ? (
                  <p className="ui-text-small ui-text-muted">No matching nodes.</p>
                ) : (
                  <div className="ui-workflow-canvas-drawer__list">
                    {options.map((option) => (
                      <article key={option.id} className="ui-workflow-canvas-palette-option ui-stack ui-stack--2xs">
                        <div className="ui-text-small"><strong>{option.title}</strong></div>
                        <div className="ui-text-small ui-text-secondary">{option.summary}</div>
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          data-testid={`workflow-canvas-palette-add-${option.id.replace(/[^a-zA-Z0-9-]/g, "-")}`}
                          onClick={() => applyAction(option.action)}
                        >
                          Add to Canvas
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderInspector = (): JSX.Element => (
    <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs ui-workflow-studio-canvas__inspector" data-testid="workflow-canvas-inspector">
      <strong>{drawerState?.right?.label ?? "Node inspector"}</strong>
      {selectedItemNode ? renderNodeEditor(selectedItemNode) : (
        <p className="ui-text-muted">Select a node to edit it.</p>
      )}
    </aside>
  );

  return (
    <div className="ui-stack ui-stack--sm ui-workflow-studio-canvas" data-testid="workflow-studio-canvas-mode-surface">
      <section className="ui-workflow-studio-canvas__canvas-shell ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-summary">
        <header className="ui-row ui-row--between ui-row--wrap ui-workflow-studio-canvas__canvas-header">
          <strong>Workflow Canvas</strong>
          <span className="ui-text-small ui-text-secondary">
            Nodes: {viewModel.totalNodeCount} | Validation issues: {viewModel.totalIssueCount}
          </span>
        </header>
        <WorkflowStudioCanvasReactFlow
          graph={viewModel.graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onClearSelection={() => setSelectedNodeId(undefined)}
          onRemoveNode={handleRemoveNode}
          renderNodeEditor={renderNodeEditor}
        />
      </section>

      <div className="ui-workflow-studio-canvas__drawer-layout">
        <div className="ui-stack ui-stack--sm ui-workflow-studio-canvas__details">
          {!leftDrawerEnabled ? renderPalette() : null}
          {!rightDrawerEnabled ? renderInspector() : null}

          <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-graph-details">
            <summary className="ui-text-small">Canvas graph projection</summary>
            <p className="ui-text-small ui-text-secondary">
              Graph nodes: {viewModel.graph.nodes.length} | Graph edges: {viewModel.graph.edges.length}
            </p>
          </details>

          <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-json-details">
            <summary className="ui-text-small">Canonical workflow draft JSON</summary>
            <textarea
              className="ui-textarea"
              rows={8}
              value={draftEditorContent}
              onChange={(event) => onChangeDraftEditorContent(event.target.value)}
            />
          </details>
        </div>

        {rightDrawerEnabled && rightDrawerOpen ? (
          <aside className="ui-workflow-studio-canvas__drawer ui-workflow-studio-canvas__drawer--right">
            {renderInspector()}
          </aside>
        ) : null}
      </div>

      {leftDrawerEnabled && leftDrawerOpen ? (
        <aside
          className="ui-workflow-studio-canvas__drawer-overlay ui-workflow-studio-canvas__drawer-overlay--left"
          data-testid="workflow-canvas-left-drawer"
        >
          {renderPalette()}
        </aside>
      ) : null}
    </div>
  );
}
