import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection } from "@xyflow/react";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftInputSourceTypes,
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepTypes,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraft,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionState,
} from "../../../../application/studio-entry/AssetSelectorSessionStore";
import AssetSelectorShell from "../asset-selector/AssetSelectorShell";
import {
  applyWorkflowCanvasAction,
  applyWorkflowCanvasConnection,
  applyWorkflowCanvasEdgeReconnect,
  deriveWorkflowCanvasViewModel,
  resolveWorkflowCanvasEdgeRemovalAction,
  WorkflowCanvasGraphNodeKinds,
  WorkflowCanvasSectionIds,
  type WorkflowCanvasAction,
  type WorkflowCanvasGraphNodeViewModel,
  type WorkflowCanvasSectionId,
} from "../../../studio-shell/workflow/WorkflowStudioCanvasViewModel";
import { RegistryService } from "../../../services/RegistryService";
import { getAssetSelectorSessionStore } from "../../../studio-shell/asset-selector/AssetSelectorSessionRegistry";
import type { AssetSelectorResultItem } from "../../../studio-shell/asset-selector/AssetSelectorDataProvider";
import {
  createDatasetAssetSelectorRequest,
  DatasetAssetSelectorAdapter,
} from "../../../studio-shell/asset-selector/DatasetAssetSelectorAdapter";
import {
  AgentAssistantAssetSelectorAdapter,
  createAgentAssistantAssetSelectorRequest,
} from "../../../studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter";
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
  readonly studioId?: string;
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

const canvasDatasetSelectorOriginatingField = "canvas.inputs.dataset";
const canvasAgentSelectorOriginatingField = "canvas.steps.agent-assistant";

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

function countCompletedStates(state?: AssetSelectorSessionState): number {
  if (!state) {
    return 0;
  }
  return state.lifecycleHistory.filter(
    (entry) => entry === AssetSelectorSessionLifecycleStates.completed,
  ).length;
}

function toDelimitedValues(values?: ReadonlyArray<string>): string {
  return values?.join(", ") ?? "";
}

function parseDelimitedValues(raw: string): ReadonlyArray<string> | undefined {
  const parsed = Array.from(new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  ));
  return parsed.length > 0 ? Object.freeze(parsed) : undefined;
}

export default function WorkflowStudioCanvasModeSurface({
  studioId,
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  draftEditorContent,
  onChangeDraftEditorContent,
  drawerState,
}: WorkflowStudioCanvasModeSurfaceProps): JSX.Element {
  const selectorSessionStore = useMemo(() => getAssetSelectorSessionStore(), []);
  const registryService = useMemo(() => new RegistryService(), []);
  const datasetSelectorAdapter = useMemo(
    () => new DatasetAssetSelectorAdapter({ registryService, limit: 50 }),
    [registryService],
  );
  const agentSelectorAdapter = useMemo(
    () => new AgentAssistantAssetSelectorAdapter({ registryService, limit: 50 }),
    [registryService],
  );
  const datasetSelectorSessionKey = useMemo(
    () => `workflow-studio:${studioId?.trim() || "default"}:canvas:inputs:dataset`,
    [studioId],
  );
  const agentSelectorSessionKey = useMemo(
    () => `workflow-studio:${studioId?.trim() || "default"}:canvas:steps:agent`,
    [studioId],
  );
  const datasetSelectorRequest = useMemo(
    () => createDatasetAssetSelectorRequest({
      requestId: `selector:${datasetSelectorSessionKey}`,
      selectionMode: "single-select",
      minSelections: 0,
      maxSelections: 1,
      required: false,
      originatingStudio: "workflow-studio",
      originatingField: canvasDatasetSelectorOriginatingField,
      launchSource: "canvas",
    }),
    [datasetSelectorSessionKey],
  );
  const agentSelectorRequest = useMemo(
    () => createAgentAssistantAssetSelectorRequest({
      requestId: `selector:${agentSelectorSessionKey}`,
      selectionMode: "single-select",
      minSelections: 0,
      maxSelections: 1,
      required: false,
      originatingStudio: "workflow-studio",
      originatingField: canvasAgentSelectorOriginatingField,
      launchSource: "canvas",
    }),
    [agentSelectorSessionKey],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [canvasInteractionMessage, setCanvasInteractionMessage] = useState<string | undefined>(undefined);
  const [datasetSelectorState, setDatasetSelectorState] = useState<AssetSelectorSessionState | undefined>(
    () => selectorSessionStore.getSession(datasetSelectorSessionKey),
  );
  const [datasetSelectorOpenInputId, setDatasetSelectorOpenInputId] = useState<string | undefined>(undefined);
  const [datasetSelectorSearchTerm, setDatasetSelectorSearchTerm] = useState("");
  const [datasetSelectorItems, setDatasetSelectorItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [datasetSelectorLoading, setDatasetSelectorLoading] = useState(false);
  const [datasetSelectorError, setDatasetSelectorError] = useState<string | undefined>(undefined);
  const [datasetSelectorQueryRevision, setDatasetSelectorQueryRevision] = useState(0);
  const [agentSelectorState, setAgentSelectorState] = useState<AssetSelectorSessionState | undefined>(
    () => selectorSessionStore.getSession(agentSelectorSessionKey),
  );
  const [agentSelectorOpenStepId, setAgentSelectorOpenStepId] = useState<string | undefined>(undefined);
  const [agentSelectorSearchTerm, setAgentSelectorSearchTerm] = useState("");
  const [agentSelectorItems, setAgentSelectorItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [agentSelectorLoading, setAgentSelectorLoading] = useState(false);
  const [agentSelectorError, setAgentSelectorError] = useState<string | undefined>(undefined);
  const [agentSelectorQueryRevision, setAgentSelectorQueryRevision] = useState(0);
  const datasetAppliedCompletedCountRef = useRef<number | undefined>(undefined);
  const agentAppliedCompletedCountRef = useRef<number | undefined>(undefined);
  const viewModel = useMemo(
    () => deriveWorkflowCanvasViewModel(sharedDraft, draftValidationIssues),
    [draftValidationIssues, sharedDraft],
  );
  const paletteOptions = useMemo(() => buildPaletteOptions(), []);
  const graphNodesById = useMemo(
    () => new Map(viewModel.graph.nodes.map((node) => [node.id, node])),
    [viewModel.graph.nodes],
  );
  const graphEdgesById = useMemo(
    () => new Map(viewModel.graph.edges.map((edge) => [edge.id, edge])),
    [viewModel.graph.edges],
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

  useEffect(() => {
    const existing = selectorSessionStore.getSession(datasetSelectorSessionKey);
    if (!existing) {
      selectorSessionStore.prepareSession({
        sessionKey: datasetSelectorSessionKey,
        request: datasetSelectorRequest,
      });
    }
    selectorSessionStore.activateSession(datasetSelectorSessionKey);
    const unsubscribe = selectorSessionStore.subscribe(datasetSelectorSessionKey, setDatasetSelectorState);
    return unsubscribe;
  }, [datasetSelectorRequest, datasetSelectorSessionKey, selectorSessionStore]);

  useEffect(() => {
    const existing = selectorSessionStore.getSession(agentSelectorSessionKey);
    if (!existing) {
      selectorSessionStore.prepareSession({
        sessionKey: agentSelectorSessionKey,
        request: agentSelectorRequest,
      });
    }
    selectorSessionStore.activateSession(agentSelectorSessionKey);
    const unsubscribe = selectorSessionStore.subscribe(agentSelectorSessionKey, setAgentSelectorState);
    return unsubscribe;
  }, [agentSelectorRequest, agentSelectorSessionKey, selectorSessionStore]);

  useEffect(() => {
    if (!datasetSelectorOpenInputId) {
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      setDatasetSelectorLoading(true);
      setDatasetSelectorError(undefined);
      const response = await datasetSelectorAdapter.query({
        request: datasetSelectorRequest,
        searchTerm: datasetSelectorSearchTerm,
      });
      if (!active) {
        return;
      }
      setDatasetSelectorItems(response.items);
      setDatasetSelectorError(response.error);
      setDatasetSelectorLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    datasetSelectorAdapter,
    datasetSelectorOpenInputId,
    datasetSelectorQueryRevision,
    datasetSelectorRequest,
    datasetSelectorSearchTerm,
  ]);

  useEffect(() => {
    if (!agentSelectorOpenStepId) {
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      setAgentSelectorLoading(true);
      setAgentSelectorError(undefined);
      const response = await agentSelectorAdapter.query({
        request: agentSelectorRequest,
        searchTerm: agentSelectorSearchTerm,
      });
      if (!active) {
        return;
      }
      setAgentSelectorItems(response.items);
      setAgentSelectorError(response.error);
      setAgentSelectorLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    agentSelectorAdapter,
    agentSelectorOpenStepId,
    agentSelectorQueryRevision,
    agentSelectorRequest,
    agentSelectorSearchTerm,
  ]);

  useEffect(() => {
    const completedCount = countCompletedStates(datasetSelectorState);
    if (datasetAppliedCompletedCountRef.current === undefined) {
      datasetAppliedCompletedCountRef.current = completedCount;
      return;
    }
    if (completedCount <= datasetAppliedCompletedCountRef.current || !datasetSelectorOpenInputId) {
      return;
    }
    datasetAppliedCompletedCountRef.current = completedCount;
    const selectedAsset = datasetSelectorState?.selectedAssets[0];
    if (!selectedAsset?.assetId) {
      return;
    }
    const result = applyAction({
      kind: "set-input-dataset-asset",
      inputId: datasetSelectorOpenInputId,
      assetId: selectedAsset.assetId,
      versionId: selectedAsset.versionId,
      displayName: selectedAsset.displayName,
    });
    if (!result.changed) {
      setCanvasInteractionMessage("Dataset selection could not be applied to this input node.");
      return;
    }
    setCanvasInteractionMessage(undefined);
    setDatasetSelectorOpenInputId(undefined);
  }, [datasetSelectorOpenInputId, datasetSelectorState]);

  useEffect(() => {
    const completedCount = countCompletedStates(agentSelectorState);
    if (agentAppliedCompletedCountRef.current === undefined) {
      agentAppliedCompletedCountRef.current = completedCount;
      return;
    }
    if (completedCount <= agentAppliedCompletedCountRef.current || !agentSelectorOpenStepId) {
      return;
    }
    agentAppliedCompletedCountRef.current = completedCount;
    const selectedAsset = agentSelectorState?.selectedAssets[0];
    if (!selectedAsset?.assetId) {
      return;
    }
    const result = applyAction({
      kind: "set-step-agent-asset",
      stepId: agentSelectorOpenStepId,
      assetId: selectedAsset.assetId,
      versionId: selectedAsset.versionId,
      displayName: selectedAsset.displayName,
    });
    if (!result.changed) {
      setCanvasInteractionMessage("Agent selection could not be applied to this step node.");
      return;
    }
    setCanvasInteractionMessage(undefined);
    setAgentSelectorOpenStepId(undefined);
  }, [agentSelectorOpenStepId, agentSelectorState]);

  const updateSharedDraft = (updater: (draft: WorkflowDraft) => WorkflowDraft): void => {
    onUpdateSharedDraft?.(updater);
  };

  const applyAction = (action: WorkflowCanvasAction): { readonly changed: boolean } => {
    let changed = false;
    updateSharedDraft((draft) => {
      const result = applyWorkflowCanvasAction(draft, action);
      changed = result.changed;
      return result.draft;
    });
    return Object.freeze({ changed });
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

  const handleStepNodeDragStop = (nodeId: string, position: { readonly x: number; readonly y: number }): void => {
    const movedNode = graphNodesById.get(nodeId);
    if (!movedNode || movedNode.kind !== WorkflowCanvasGraphNodeKinds.item || movedNode.sectionId !== WorkflowCanvasSectionIds.steps) {
      return;
    }

    const currentStepOrder = sharedDraft.steps.map((step) => step.id);
    const reorderedStepIds = viewModel.graph.nodes
      .filter((node) => node.kind === WorkflowCanvasGraphNodeKinds.item && node.sectionId === WorkflowCanvasSectionIds.steps)
      .map((node) => (
        node.id === nodeId
          ? Object.freeze({
            id: node.entityId as string,
            y: position.y,
          })
          : Object.freeze({
            id: node.entityId as string,
            y: node.position.y,
          })
      ))
      .sort((left, right) => left.y - right.y)
      .map((entry) => entry.id);

    const noOrderChange = reorderedStepIds.length === currentStepOrder.length
      && reorderedStepIds.every((stepId, index) => stepId === currentStepOrder[index]);
    if (noOrderChange) {
      return;
    }

    const result = applyAction({
      kind: "reorder-steps",
      orderedStepIds: Object.freeze(reorderedStepIds),
    });
    if (!result.changed) {
      setCanvasInteractionMessage("Step reorder was rejected by workflow ordering guardrails.");
      return;
    }
    setCanvasInteractionMessage(undefined);
  };

  const handleCreateConnection = (connection: Connection): void => {
    if (!connection.source || !connection.target) {
      return;
    }
    let changed = false;
    updateSharedDraft((draft) => {
      const result = applyWorkflowCanvasConnection(draft, viewModel.graph, {
        sourceNodeId: connection.source as string,
        targetNodeId: connection.target as string,
        sourceHandleId: connection.sourceHandle ?? undefined,
        targetHandleId: connection.targetHandle ?? undefined,
      });
      changed = result.changed;
      return result.draft;
    });
    if (!changed) {
      setCanvasInteractionMessage("Unsupported connection. Use Step->Step, If/Then branch handles, or Step->Output links.");
      return;
    }
    setCanvasInteractionMessage(undefined);
  };

  const handleReconnectConnection = (edgeId: string, connection: Connection): void => {
    if (!connection.source || !connection.target) {
      return;
    }
    const edge = graphEdgesById.get(edgeId);
    if (!edge) {
      return;
    }
    let changed = false;
    updateSharedDraft((draft) => {
      const result = applyWorkflowCanvasEdgeReconnect(draft, viewModel.graph, {
        edge,
        nextConnection: {
          sourceNodeId: connection.source as string,
          targetNodeId: connection.target as string,
          sourceHandleId: connection.sourceHandle ?? undefined,
          targetHandleId: connection.targetHandle ?? undefined,
        },
      });
      changed = result.changed;
      return result.draft;
    });
    if (!changed) {
      setCanvasInteractionMessage("Connection update was rejected by workflow guardrails.");
      return;
    }
    setCanvasInteractionMessage(undefined);
  };

  const handleRemoveConnection = (edgeId: string): void => {
    const edge = graphEdgesById.get(edgeId);
    if (!edge) {
      return;
    }
    const removeAction = resolveWorkflowCanvasEdgeRemovalAction(edge);
    if (!removeAction) {
      return;
    }
    const result = applyAction(removeAction);
    if (!result.changed) {
      setCanvasInteractionMessage("Connection removal could not be applied.");
      return;
    }
    setCanvasInteractionMessage(undefined);
  };

  const openDatasetSelectorForInput = (inputId: string): void => {
    const input = sharedDraft.inputs.find((entry) => entry.id === inputId);
    if (!input || input.sourceType !== WorkflowDraftInputSourceTypes.datasetAsset) {
      return;
    }
    selectorSessionStore.activateSession(datasetSelectorSessionKey);
    selectorSessionStore.setPendingSelections(datasetSelectorSessionKey, Object.freeze([{
      assetId: input.asset.assetId,
      versionId: input.asset.versionId,
      assetType: "dataset",
      displayName: input.title,
      taxonomy: input.asset.taxonomy,
    }]));
    setDatasetSelectorOpenInputId(inputId);
    setDatasetSelectorSearchTerm("");
    setDatasetSelectorQueryRevision((current) => current + 1);
  };

  const openAgentSelectorForStep = (stepId: string): void => {
    const step = sharedDraft.steps.find((entry) => entry.id === stepId);
    if (!step) {
      return;
    }
    const selectedAgent = step.assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant
      ? step.assetRef.asset
      : undefined;
    selectorSessionStore.activateSession(agentSelectorSessionKey);
    selectorSessionStore.setPendingSelections(agentSelectorSessionKey, selectedAgent
      ? Object.freeze([{
        assetId: selectedAgent.assetId,
        versionId: selectedAgent.versionId,
        assetType: "agent",
        displayName: step.title,
        taxonomy: selectedAgent.taxonomy,
      }])
      : Object.freeze([]));
    setAgentSelectorOpenStepId(stepId);
    setAgentSelectorSearchTerm("");
    setAgentSelectorQueryRevision((current) => current + 1);
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
      const datasetSelectorStateForShell = datasetSelectorState ?? selectorSessionStore.getSession(datasetSelectorSessionKey);
      const isDatasetSelectorOpen = datasetSelectorOpenInputId === input.id;
      const unavailableDatasetSelection = input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset
        && !datasetSelectorLoading
        && !datasetSelectorError
        && datasetSelectorSearchTerm.trim().length === 0
        && datasetSelectorItems.length > 0
        && !datasetSelectorItems.some((item) => item.asset.assetId === input.asset.assetId);
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
          {input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset ? (
            <>
              <div className="ui-text-small ui-text-secondary">
                Linked dataset: {input.asset.assetId}{input.asset.versionId ? ` (${input.asset.versionId})` : ""}
              </div>
              {unavailableDatasetSelection ? (
                <div className="ui-text-small ui-text-danger">
                  Selected dataset is currently unavailable in the dataset catalog.
                </div>
              ) : null}
              <div className="ui-row ui-row--wrap">
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  data-testid={`workflow-canvas-input-select-dataset-${input.id}`}
                  onClick={() => openDatasetSelectorForInput(input.id)}
                >
                  Select dataset
                </button>
                {isDatasetSelectorOpen ? (
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      selectorSessionStore.activateSession(datasetSelectorSessionKey);
                      selectorSessionStore.clearPendingSelections(datasetSelectorSessionKey);
                      setDatasetSelectorOpenInputId(undefined);
                    }}
                  >
                    Close selector
                  </button>
                ) : null}
              </div>
              {isDatasetSelectorOpen && datasetSelectorStateForShell ? (
                <AssetSelectorShell
                  title="Dataset selector"
                  state={datasetSelectorStateForShell}
                  searchTerm={datasetSelectorSearchTerm}
                  items={datasetSelectorItems}
                  loading={datasetSelectorLoading}
                  error={datasetSelectorError}
                  onSearchTermChange={setDatasetSelectorSearchTerm}
                  onToggleSelection={(item) => {
                    selectorSessionStore.togglePendingSelection(datasetSelectorSessionKey, item.asset);
                  }}
                  onConfirm={() => {
                    selectorSessionStore.confirmPendingSelections(datasetSelectorSessionKey);
                  }}
                  onCancel={() => {
                    selectorSessionStore.cancelSession(datasetSelectorSessionKey, "user-cancelled-selector");
                    selectorSessionStore.activateSession(datasetSelectorSessionKey);
                    setDatasetSelectorOpenInputId(undefined);
                  }}
                  onCreateNew={() => {
                    setCanvasInteractionMessage(
                      "Create-new dataset handoff is available in Wizard Inputs. Use that flow, then return to Canvas.",
                    );
                  }}
                  onRetry={() => {
                    setDatasetSelectorQueryRevision((current) => current + 1);
                  }}
                />
              ) : null}
            </>
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
      const stepIndex = sharedDraft.steps.findIndex((entry) => entry.id === step.id);
      const agentSelectorStateForShell = agentSelectorState ?? selectorSessionStore.getSession(agentSelectorSessionKey);
      const isAgentSelectorOpen = agentSelectorOpenStepId === step.id;
      const ifThenConfig = step.type === WorkflowDraftBuiltInStepTypes.ifThen
        ? (step.config as WorkflowDraftIfThenStepConfig | undefined)
        : undefined;
      const ifThenThenStepIds = ifThenConfig
        ? (ifThenConfig.branches?.then?.stepIds ?? ifThenConfig.thenStepIds)
        : undefined;
      const ifThenElseStepIds = ifThenConfig
        ? (ifThenConfig.branches?.else?.stepIds ?? ifThenConfig.elseStepIds)
        : undefined;
      const unavailableAgentSelection = Boolean(
        step.assetRef?.asset.assetId
        && !agentSelectorLoading
        && !agentSelectorError
        && agentSelectorSearchTerm.trim().length === 0
        && agentSelectorItems.length > 0
        && !agentSelectorItems.some((item) => item.asset.assetId === step.assetRef?.asset.assetId),
      );
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
            <div className="ui-stack ui-stack--2xs">
              <label className="ui-stack ui-stack--3xs">
                <span className="ui-text-small ui-text-secondary">Condition expression</span>
                <input
                  className="ui-input"
                  data-testid={`workflow-canvas-if-then-condition-${step.id}`}
                  value={String(ifThenConfig?.conditionExpression ?? "")}
                  onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                    conditionExpression: event.target.value,
                  }).draft)}
                />
              </label>
              <label className="ui-stack ui-stack--3xs">
                <span className="ui-text-small ui-text-secondary">Then label</span>
                <input
                  className="ui-input"
                  value={ifThenConfig?.branches?.then?.label ?? ifThenConfig?.thenLabel ?? ""}
                  onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                    thenLabel: event.target.value,
                  }).draft)}
                />
              </label>
              <label className="ui-stack ui-stack--3xs">
                <span className="ui-text-small ui-text-secondary">Else label (optional)</span>
                <input
                  className="ui-input"
                  value={ifThenConfig?.branches.else?.label ?? ifThenConfig?.elseLabel ?? ""}
                  onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                    elseLabel: event.target.value,
                  }).draft)}
                />
              </label>
              <label className="ui-stack ui-stack--3xs">
                <span className="ui-text-small ui-text-secondary">Then branch step IDs</span>
                <input
                  className="ui-input"
                  value={toDelimitedValues(ifThenThenStepIds)}
                  onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                    thenStepIds: parseDelimitedValues(event.target.value),
                  }).draft)}
                />
              </label>
              <label className="ui-stack ui-stack--3xs">
                <span className="ui-text-small ui-text-secondary">Else branch step IDs</span>
                <input
                  className="ui-input"
                  value={toDelimitedValues(ifThenElseStepIds)}
                  onChange={(event) => updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                    elseStepIds: parseDelimitedValues(event.target.value),
                  }).draft)}
                />
              </label>
              <div className="ui-text-small ui-text-secondary">
                Drag from the Then/Else branch handles on this node to wire branch paths visually.
              </div>
            </div>
          ) : null}
          {step.type === WorkflowDraftStepTypes.agentAssistant ? (
            <>
              <div className="ui-text-small ui-text-secondary">
                Linked agent: {step.assetRef?.asset.assetId ?? "none selected"}
              </div>
              {unavailableAgentSelection ? (
                <div className="ui-text-small ui-text-danger">
                  Selected agent is currently unavailable in the agent catalog.
                </div>
              ) : null}
              <div className="ui-row ui-row--wrap">
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  data-testid={`workflow-canvas-step-select-agent-${step.id}`}
                  onClick={() => openAgentSelectorForStep(step.id)}
                >
                  Select agent
                </button>
                {isAgentSelectorOpen ? (
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      selectorSessionStore.activateSession(agentSelectorSessionKey);
                      selectorSessionStore.clearPendingSelections(agentSelectorSessionKey);
                      setAgentSelectorOpenStepId(undefined);
                    }}
                  >
                    Close selector
                  </button>
                ) : null}
              </div>
              {isAgentSelectorOpen && agentSelectorStateForShell ? (
                <AssetSelectorShell
                  title="Agent selector"
                  state={agentSelectorStateForShell}
                  searchTerm={agentSelectorSearchTerm}
                  items={agentSelectorItems}
                  loading={agentSelectorLoading}
                  error={agentSelectorError}
                  onSearchTermChange={setAgentSelectorSearchTerm}
                  onToggleSelection={(item) => {
                    selectorSessionStore.togglePendingSelection(agentSelectorSessionKey, item.asset);
                  }}
                  onConfirm={() => {
                    selectorSessionStore.confirmPendingSelections(agentSelectorSessionKey);
                  }}
                  onCancel={() => {
                    selectorSessionStore.cancelSession(agentSelectorSessionKey, "user-cancelled-selector");
                    selectorSessionStore.activateSession(agentSelectorSessionKey);
                    setAgentSelectorOpenStepId(undefined);
                  }}
                  onCreateNew={() => {
                    setCanvasInteractionMessage(
                      "Create-new agent handoff is available in Wizard Steps. Use that flow, then return to Canvas.",
                    );
                  }}
                  onRetry={() => {
                    setAgentSelectorQueryRevision((current) => current + 1);
                  }}
                />
              ) : null}
            </>
          ) : null}
          <div className="ui-row ui-row--wrap">
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              data-testid={`workflow-canvas-step-move-up-${step.id}`}
              disabled={stepIndex <= 0}
              onClick={() => {
                if (stepIndex <= 0) {
                  return;
                }
                const orderedStepIds = [...sharedDraft.steps.map((entry) => entry.id)];
                [orderedStepIds[stepIndex - 1], orderedStepIds[stepIndex]] = [orderedStepIds[stepIndex], orderedStepIds[stepIndex - 1]];
                const result = applyAction({ kind: "reorder-steps", orderedStepIds: Object.freeze(orderedStepIds) });
                if (!result.changed) {
                  setCanvasInteractionMessage("Step reorder was rejected by workflow ordering guardrails.");
                  return;
                }
                setCanvasInteractionMessage(undefined);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              data-testid={`workflow-canvas-step-move-down-${step.id}`}
              disabled={stepIndex < 0 || stepIndex >= sharedDraft.steps.length - 1}
              onClick={() => {
                if (stepIndex < 0 || stepIndex >= sharedDraft.steps.length - 1) {
                  return;
                }
                const orderedStepIds = [...sharedDraft.steps.map((entry) => entry.id)];
                [orderedStepIds[stepIndex + 1], orderedStepIds[stepIndex]] = [orderedStepIds[stepIndex], orderedStepIds[stepIndex + 1]];
                const result = applyAction({ kind: "reorder-steps", orderedStepIds: Object.freeze(orderedStepIds) });
                if (!result.changed) {
                  setCanvasInteractionMessage("Step reorder was rejected by workflow ordering guardrails.");
                  return;
                }
                setCanvasInteractionMessage(undefined);
              }}
            >
              Move down
            </button>
          </div>
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
          onStepNodeDragStop={handleStepNodeDragStop}
          onCreateConnection={handleCreateConnection}
          onReconnectConnection={handleReconnectConnection}
          onRemoveConnection={handleRemoveConnection}
          renderNodeEditor={renderNodeEditor}
        />
        {canvasInteractionMessage ? (
          <p className="ui-text-small ui-text-secondary" data-testid="workflow-canvas-interaction-message">
            {canvasInteractionMessage}
          </p>
        ) : null}
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
