import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import NodePalette from "../components/nodes/NodePalette";
import NodeInspector from "../components/nodes/NodeInspector";
import WorkflowCanvas from "../components/workflow/WorkflowCanvas";
import WorkflowMetadataPanel from "../components/workflow/WorkflowMetadataPanel";
import WorkflowNodeList from "../components/workflow/WorkflowNodeList";
import WorkflowValidationPanel from "../components/workflow/WorkflowValidationPanel";
import { NodePresenter } from "../presenters/NodePresenter";
import { WorkflowPresenter } from "../presenters/WorkflowPresenter";
import { ValidationPresenter } from "../presenters/ValidationPresenter";
import { NodeStore, type INodeStoreState } from "../state/NodeStore";
import { WorkflowStore, type IWorkflowStoreState } from "../state/WorkflowStore";

export interface WorkflowEditorPageProps {
  readonly workflowStore?: WorkflowStore;
  readonly nodeStore?: NodeStore;
}

const fallbackWorkflowState: IWorkflowStoreState = Object.freeze({
  workflows: Object.freeze([]),
  currentWorkflow: undefined,
  validation: undefined,
  selectedNodeId: undefined,
  selectedConnectionId: undefined,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  isExecuting: false,
  lastExecutionEvent: undefined,
  error: undefined,
});

const fallbackNodeState: INodeStoreState = Object.freeze({
  definitions: Object.freeze([]),
  categories: Object.freeze([]),
  selectedDefinitionId: undefined,
  searchCriteria: undefined,
  isLoading: false,
  error: undefined,
});

export default function WorkflowEditorPage({
  workflowStore,
  nodeStore,
}: WorkflowEditorPageProps): JSX.Element {
  const { workflowId } = useParams<{ workflowId: string }>();

  const [workflowState, setWorkflowState] =
    useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [nodeState, setNodeState] = useState<INodeStoreState>(fallbackNodeState);

  const nodePresenter = useMemo(() => new NodePresenter(), []);
  const workflowPresenter = useMemo(() => new WorkflowPresenter(), []);
  const validationPresenter = useMemo(() => new ValidationPresenter(), []);

  const createdNewWorkflowRef = useRef(false);

  useEffect(() => {
    if (!workflowStore) {
      return;
    }

    return workflowStore.subscribe(setWorkflowState);
  }, [workflowStore]);

  useEffect(() => {
    if (!nodeStore) {
      return;
    }

    return nodeStore.subscribe(setNodeState);
  }, [nodeStore]);

  useEffect(() => {
    if (!nodeStore) {
      return;
    }

    void nodeStore.refreshCatalog();
  }, [nodeStore]);

  useEffect(() => {
    if (!workflowStore) {
      return;
    }

    if (workflowId && workflowId !== "new") {
      createdNewWorkflowRef.current = false;
      void workflowStore.loadWorkflow(workflowId);
      return;
    }

    if (workflowId === "new" && !createdNewWorkflowRef.current) {
      createdNewWorkflowRef.current = true;
      void workflowStore.createWorkflow({
        metadata: {
          name: "Untitled Workflow",
          description: "",
          tags: [],
        },
        validateOnCreate: false,
      });
    }
  }, [workflowId, workflowStore]);

  const paletteItems = useMemo(
    () => nodePresenter.presentPalette(nodeState.definitions),
    [nodePresenter, nodeState.definitions]
  );

  const currentWorkflow = workflowState.currentWorkflow;

  const nodeViewModels = useMemo(() => {
    if (!currentWorkflow) {
      return [];
    }

    return currentWorkflow.nodes.map((node) => nodePresenter.presentNode(node));
  }, [currentWorkflow, nodePresenter]);

  const editorViewModel = useMemo(() => {
    if (!currentWorkflow) {
      return undefined;
    }

    return workflowPresenter.present(currentWorkflow, {
      validation: workflowState.validation,
      selectedNodeId: workflowState.selectedNodeId,
      selectedConnectionId: workflowState.selectedConnectionId,
      isDirty: workflowState.isDirty,
      lastExecutionEvent: workflowState.lastExecutionEvent,
    });
  }, [currentWorkflow, workflowPresenter, workflowState]);

  const selectedNode = editorViewModel?.selectedNode;
  const validationSummary = validationPresenter.present(workflowState.validation);

  const addNode = async (definitionId: string): Promise<void> => {
    if (!workflowStore) {
      return;
    }

    const nextIndex = currentWorkflow?.nodes.length ?? 0;

    await workflowStore.createNode({
      definitionId,
      position: {
        x: 40 + nextIndex * 24,
        y: 40 + nextIndex * 24,
      },
      title: undefined,
    });
  };

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workflow Editor</h1>
          <p className="ui-page__subtitle">
            {workflowId && workflowId !== "new"
              ? `Editing workflow: ${workflowId}`
              : "Create and edit workflow graphs."}
          </p>
        </div>
      </div>

      {(workflowState.error || nodeState.error) && (
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--xs">
            <div className="ui-row ui-row--wrap">
              <span className="ui-badge ui-badge--danger">Error</span>
            </div>
            <div className="ui-text-secondary">
              {workflowState.error ?? nodeState.error}
            </div>
          </div>
        </div>
      )}

      <div className="ui-page-grid ui-page-grid--editor">
        <div className="ui-stack ui-stack--md">
          <WorkflowMetadataPanel
            workflow={editorViewModel?.header}
            isSaving={workflowState.isSaving}
            isExecuting={workflowState.isExecuting}
            onRenameWorkflow={(name) => {
              workflowStore?.renameCurrentWorkflow(name);
            }}
            onUpdateDescription={(description) => {
              workflowStore?.updateCurrentWorkflowDescription(description);
            }}
            onSaveWorkflow={() => {
              if (!workflowStore) {
                return;
              }

              void workflowStore.saveCurrentWorkflow();
            }}
            onValidateWorkflow={() => {
              workflowStore?.validateCurrentWorkflow();
            }}
            onExecuteWorkflow={() => {
              if (!workflowStore) {
                return;
              }

              void workflowStore.executeCurrentWorkflow();
            }}
          />

          <WorkflowValidationPanel validation={validationSummary} />
        </div>

        <div className="ui-stack ui-stack--md">
          <NodePalette
            items={paletteItems}
            categories={nodeState.categories}
            selectedDefinitionId={nodeState.selectedDefinitionId}
            isLoading={nodeState.isLoading}
            onSelect={(definitionId) => {
              if (!nodeStore) {
                return;
              }

              void nodeStore.selectDefinition(definitionId);
            }}
            onAdd={(definitionId) => {
              void addNode(definitionId);
            }}
            onSearch={(query, category) => {
              if (!nodeStore) {
                return;
              }

              void nodeStore.refreshCatalog({
                query: query || undefined,
                categories: category ? [category] : undefined,
              });
            }}
          />

          <WorkflowCanvas
            nodes={nodeViewModels}
            selectedNodeId={workflowState.selectedNodeId}
            onSelectNode={(nodeId) => {
              workflowStore?.selectNode(nodeId);
            }}
            onMoveNodeCommit={(nodeId, position) => {
              workflowStore?.moveNode(nodeId, position);
            }}
          />

          <WorkflowNodeList
            nodes={nodeViewModels}
            selectedNodeId={workflowState.selectedNodeId}
            onSelectNode={(nodeId) => {
              workflowStore?.selectNode(nodeId);
            }}
            onRemoveNode={(nodeId) => {
              workflowStore?.removeNode(nodeId);
            }}
          />
        </div>

        <div className="ui-stack ui-stack--md">
          <NodeInspector
            node={selectedNode}
            onPropertyChange={(propertyId, value) => {
              if (!workflowStore || !workflowState.selectedNodeId) {
                return;
              }

              workflowStore.updateNodeProperty(
                workflowState.selectedNodeId,
                propertyId,
                value
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
