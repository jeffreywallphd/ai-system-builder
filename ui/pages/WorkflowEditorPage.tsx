import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import NodePalette from "../components/nodes/NodePalette";
import NodeInspector from "../components/nodes/NodeInspector";
import NodePropertyEditor from "../components/nodes/NodePropertyEditor";
import ConnectionInspector from "../components/workflow/ConnectionInspector";
import WorkflowExecutionStatusPanel from "../components/execution/WorkflowExecutionStatusPanel";
import WorkflowCanvas from "../components/workflow/WorkflowCanvas";
import WorkflowCanvasToolbar from "../components/workflow/WorkflowCanvasToolbar";
import WorkflowMetadataPanel from "../components/workflow/WorkflowMetadataPanel";
import WorkflowValidationPanel from "../components/workflow/WorkflowValidationPanel";
import WorkflowViewModeToggle from "../components/workflow/WorkflowViewModeToggle";
import WorkflowFormView from "../components/workflow/WorkflowFormView";
import type { WorkflowViewMode } from "../state/WorkflowViewMode";
import { useUiDependencies } from "../composition/AppProviders";
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

const mobileQuery = "(max-width: 767px)";

export default function WorkflowEditorPage({
  workflowStore: workflowStoreProp,
  nodeStore: nodeStoreProp,
}: WorkflowEditorPageProps): JSX.Element {
  const {
    config,
    workflowStore: injectedWorkflowStore,
    nodeStore: injectedNodeStore,
    workflowProjectionService,
  } = useUiDependencies();

  const workflowStore = workflowStoreProp ?? injectedWorkflowStore;
  const nodeStore = nodeStoreProp ?? injectedNodeStore;

  const { workflowId } = useParams<{ workflowId: string }>();

  const [workflowState, setWorkflowState] =
    useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [nodeState, setNodeState] = useState<INodeStoreState>(fallbackNodeState);
  const [fitViewNonce, setFitViewNonce] = useState(0);
  const [viewMode, setViewMode] = useState<WorkflowViewMode>("canvas");
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [dismissedValidationMessages, setDismissedValidationMessages] = useState<
    ReadonlyArray<string>
  >([]);
  const [mobilePropertiesNodeId, setMobilePropertiesNodeId] = useState<string>();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(mobileQuery).matches;
  });

  const nodePresenter = useMemo(() => new NodePresenter(), []);
  const workflowPresenter = useMemo(() => new WorkflowPresenter(), []);
  const validationPresenter = useMemo(() => new ValidationPresenter(), []);

  const createdNewWorkflowRef = useRef(false);
  const seededStarterNodeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(mobileQuery);
    const listener = (event: MediaQueryListEvent): void => {
      setIsMobile(event.matches);

      if (!event.matches) {
        setMobilePropertiesNodeId(undefined);
      }
    };

    setIsMobile(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", listener);

    return () => {
      mediaQueryList.removeEventListener("change", listener);
    };
  }, []);

  useEffect(() => {
    return workflowStore.subscribe(setWorkflowState);
  }, [workflowStore]);

  useEffect(() => {
    return nodeStore.subscribe(setNodeState);
  }, [nodeStore]);

  useEffect(() => {
    void nodeStore.refreshCatalog();
  }, [nodeStore]);

  useEffect(() => {
    const existingWorkflow = workflowStore.getState().currentWorkflow;

    if (workflowId && workflowId !== "new") {
      createdNewWorkflowRef.current = false;
      seededStarterNodeRef.current = false;

      if (existingWorkflow?.id === workflowId) {
        return;
      }

      void workflowStore.loadWorkflow(workflowId);
      return;
    }

    if (workflowId === "new") {
      if (existingWorkflow) {
        createdNewWorkflowRef.current = true;
        return;
      }

      if (!createdNewWorkflowRef.current) {
        createdNewWorkflowRef.current = true;
        seededStarterNodeRef.current = false;

        void workflowStore.createWorkflow({
          metadata: {
            name: "Untitled Workflow",
            description: "",
            tags: [],
          },
          validateOnCreate: false,
        });
      }
    }
  }, [workflowId, workflowStore]);

  useEffect(() => {
    const currentWorkflow = workflowStore.getState().currentWorkflow;

    if (
      !config.seedStarterNode ||
      !currentWorkflow ||
      seededStarterNodeRef.current ||
      currentWorkflow.nodes.length > 0 ||
      nodeState.definitions.length === 0
    ) {
      return;
    }

    const starterDefinition = nodeState.definitions[0];
    if (!starterDefinition) {
      return;
    }

    seededStarterNodeRef.current = true;

    void workflowStore
      .createNode({
        definitionId: starterDefinition.id,
        position: {
          x: 80,
          y: 80,
        },
      })
      .then(() => {
        setFitViewNonce((value) => value + 1);
      });
  }, [config.seedStarterNode, nodeState.definitions, workflowStore]);

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

  const formSchema = useMemo(() => {
    if (!currentWorkflow) {
      return undefined;
    }
    return workflowProjectionService.projectToForm(currentWorkflow);
  }, [currentWorkflow, workflowProjectionService]);

  const selectedNode = editorViewModel?.selectedNode;

  const selectedConnection = useMemo(
    () =>
      editorViewModel?.workflow.connections.find(
        (connection) => connection.id === workflowState.selectedConnectionId
      ),
    [editorViewModel?.workflow.connections, workflowState.selectedConnectionId]
  );

  const mobilePropertiesNode = useMemo(
    () => nodeViewModels.find((node) => node.id === mobilePropertiesNodeId),
    [mobilePropertiesNodeId, nodeViewModels]
  );

  const validationSummary = validationPresenter.present(workflowState.validation);


  const visibleValidationMessages = useMemo(() => {
    const messages = validationSummary.groups.flatMap((group) =>
      group.messages.map((message) => ({
        key: `${message.code}:${message.message}:${message.targetLabel ?? ""}`,
        severity: message.severity,
        scope: message.scope,
        message: message.message,
        targetLabel: message.targetLabel,
      }))
    );

    return messages.filter((message) => !dismissedValidationMessages.includes(message.key));
  }, [dismissedValidationMessages, validationSummary.groups]);

  useEffect(() => {
    setDismissedValidationMessages((current) =>
      current.filter((messageKey) =>
        validationSummary.groups.some((group) =>
          group.messages.some(
            (message) =>
              `${message.code}:${message.message}:${message.targetLabel ?? ""}` ===
              messageKey
          )
        )
      )
    );
  }, [validationSummary.groups]);

  useEffect(() => {
    if (!workflowState.selectedNodeId) {
      setIsPropertiesOpen(false);
    }
  }, [workflowState.selectedNodeId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const className = "ui-canvas-locked";

    if (isCanvasLocked) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }

    return () => {
      document.body.classList.remove(className);
    };
  }, [isCanvasLocked]);

  const addNode = async (definitionId: string): Promise<void> => {
    const nextIndex = currentWorkflow?.nodes.length ?? 0;

    await workflowStore.createNode({
      definitionId,
      position: {
        x: 80 + nextIndex * 48,
        y: 80 + nextIndex * 48,
      },
      title: undefined,
    });

    setFitViewNonce((value) => value + 1);
    setIsLeftMenuOpen(false);
  };

  const openNodeProperties = (nodeId: string): void => {
    workflowStore.selectNode(nodeId);

    if (isMobile) {
      setMobilePropertiesNodeId(nodeId);
      return;
    }

    setIsPropertiesOpen(true);
  };

  const hasSelection =
    !!workflowState.selectedNodeId || !!workflowState.selectedConnectionId;

  const toggleCanvasLock = (): void => {
    setIsCanvasLocked((current) => !current);
  };

  return (
    <section
      className={`ui-page ui-page--editor${
        isCanvasLocked ? " ui-page--editor-canvas-locked" : ""
      }`}
    >
      {!isCanvasLocked ? (
        <div className="ui-page__hero">
          <div className="ui-page__hero-copy">
            <WorkflowViewModeToggle mode={viewMode} onModeChange={setViewMode} />
            <h1 className="ui-page__title">Workflow Editor</h1>
            <p className="ui-page__subtitle">
              {workflowId && workflowId !== "new"
                ? `Editing workflow: ${workflowId}`
                : "Create and edit workflow graphs."}
            </p>
          </div>
        </div>
      ) : null}

      {!isCanvasLocked && (workflowState.error || nodeState.error) ? (
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
      ) : null}

      <div className="ui-workspace">
        <div className="ui-workspace__main">
          <div className="ui-canvas-shell">
            <WorkflowCanvasToolbar
              isMobile={isMobile}
              hasSelection={hasSelection}
              canOpenProperties={!!selectedNode}
              isCanvasLocked={isCanvasLocked}
              isMenuOpen={isLeftMenuOpen}
              isPropertiesOpen={isPropertiesOpen}
              onToggleCanvasLock={toggleCanvasLock}
              onOpenMenu={() => {
                setIsLeftMenuOpen((value) => !value);
              }}
              onOpenProperties={() => {
                if (selectedNode) {
                  setIsPropertiesOpen((value) => !value);
                }
              }}
              onClearSelection={() => workflowStore.clearSelection()}
              onValidateWorkflow={() => workflowStore.validateCurrentWorkflow()}
            />

            <div className="ui-canvas-shell__body">
              {viewMode === "canvas" ? (
                <WorkflowCanvas
                  nodes={nodeViewModels}
                  workflow={editorViewModel?.workflow}
                  selectedNodeId={workflowState.selectedNodeId}
                  selectedConnectionId={workflowState.selectedConnectionId}
                  fitViewNonce={fitViewNonce}
                  isCompactViewport={isMobile}
                  onSelectNode={(nodeId) => {
                    workflowStore.selectNode(nodeId);
                  }}
                  onSelectConnection={(connectionId) => {
                    workflowStore.selectConnection(connectionId);
                  }}
                  onClearSelection={() => {
                    workflowStore.clearSelection();
                  }}
                  onMoveNodeCommit={(nodeId, position) => {
                    workflowStore.moveNode(nodeId, position);
                  }}
                  onConnectNodes={(request) => {
                    workflowStore.connectNodes({
                      sourceNodeId: request.sourceNodeId,
                      sourcePortId: request.sourcePortId,
                      targetNodeId: request.targetNodeId,
                      targetPortId: request.targetPortId,
                    });
                  }}
                  onOpenNodeProperties={openNodeProperties}
                  onNodePropertyChange={(nodeId, propertyId, value) => {
                    workflowStore.updateNodeProperty(nodeId, propertyId, value);
                  }}
                />
              ) : formSchema ? (
                <WorkflowFormView
                  schema={formSchema}
                  onChange={(fieldId, value) => {
                    const [nodeId, propertyId] = fieldId.split(".");
                    if (!nodeId || !propertyId) {
                      return;
                    }
                    workflowStore.updateNodeProperty(nodeId, propertyId, value);
                  }}
                />
              ) : null}


              {visibleValidationMessages.length > 0 ? (
                <div
                  className={`ui-validation-overlay${
                    isCanvasLocked ? " ui-validation-overlay--locked" : ""
                  }`}
                >
                  <div className="ui-validation-overlay__stack">
                    {visibleValidationMessages.map((validationMessage) => (
                      <article key={validationMessage.key} className="ui-card ui-validation-overlay__item">
                        <div className="ui-card__body ui-stack ui-stack--xs">
                          <div className="ui-row ui-row--between ui-row--wrap">
                            <span
                              className={`ui-badge ${
                                validationMessage.severity === "error"
                                  ? "ui-badge--danger"
                                  : validationMessage.severity === "warning"
                                    ? "ui-badge--warning"
                                    : "ui-badge--neutral"
                              }`}
                            >
                              {validationMessage.scope}
                            </span>
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm"
                              onClick={() =>
                                setDismissedValidationMessages((current) =>
                                  current.includes(validationMessage.key)
                                    ? current
                                    : [...current, validationMessage.key]
                                )
                              }
                            >
                              Close
                            </button>
                          </div>
                          <div>{validationMessage.message}</div>
                          {validationMessage.targetLabel ? (
                            <div className="ui-text-secondary ui-text-small">
                              {validationMessage.targetLabel}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                className={`ui-overlay-panel ui-overlay-panel--left${
                  isLeftMenuOpen ? " ui-overlay-panel--open" : ""
                }`}
              >
                <button
                  type="button"
                  className="ui-overlay-panel__scrim"
                  aria-label="Close menu"
                  onClick={() => setIsLeftMenuOpen(false)}
                />

                <aside className="ui-overlay-panel__surface">
                  <div className="ui-overlay-panel__header">
                    <div className="ui-stack ui-stack--2xs">
                      <div className="ui-heading-4">Workflow Menu</div>
                      <div className="ui-text-secondary ui-text-small">
                        Workflow tools, validation, palette, and connection details.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => setIsLeftMenuOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="ui-overlay-panel__body ui-stack ui-stack--md ui-scrollbar">
                    <WorkflowMetadataPanel
                      workflow={editorViewModel?.header}
                      isSaving={workflowState.isSaving}
                      isExecuting={workflowState.isExecuting}
                      onRenameWorkflow={(name) => {
                        workflowStore.renameCurrentWorkflow(name);
                      }}
                      onUpdateDescription={(description) => {
                        workflowStore.updateCurrentWorkflowDescription(description);
                      }}
                      onSaveWorkflow={() => {
                        void workflowStore.saveCurrentWorkflow();
                      }}
                      onValidateWorkflow={() => {
                        workflowStore.validateCurrentWorkflow();
                      }}
                      onExecuteWorkflow={() => {
                        void workflowStore.executeCurrentWorkflow();
                      }}
                    />

                    <WorkflowValidationPanel validation={validationSummary} />

                    <WorkflowExecutionStatusPanel
                      status={workflowState.lastExecutionEvent?.status ?? "queued"}
                      executionId={workflowState.lastExecutionEvent?.executionId}
                      currentNodeId={workflowState.lastExecutionEvent?.nodeId}
                      progressPercent={workflowState.lastExecutionEvent?.progress?.percent}
                      message={
                        workflowState.lastExecutionEvent?.message ??
                        (workflowState.isExecuting ? "Execution is in progress." : undefined)
                      }
                    />

                    <NodePalette
                      items={paletteItems}
                      categories={nodeState.categories}
                      selectedDefinitionId={nodeState.selectedDefinitionId}
                      isLoading={nodeState.isLoading}
                      onSelect={(definitionId) => {
                        void nodeStore.selectDefinition(definitionId);
                      }}
                      onAdd={(definitionId) => {
                        void addNode(definitionId);
                      }}
                      onSearch={(query, category) => {
                        void nodeStore.refreshCatalog({
                          query: query || undefined,
                          categories: category ? [category] : undefined,
                        });
                      }}
                    />

                    <ConnectionInspector
                      connection={selectedConnection}
                      onRemoveConnection={(connectionId) => {
                        workflowStore.removeConnection(connectionId);
                      }}
                    />
                  </div>
                </aside>
              </div>

              {!isMobile ? (
                <div
                  className={`ui-overlay-panel ui-overlay-panel--right${
                    isPropertiesOpen ? " ui-overlay-panel--open" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="ui-overlay-panel__scrim"
                    aria-label="Close properties"
                    onClick={() => setIsPropertiesOpen(false)}
                  />

                  <aside className="ui-overlay-panel__surface">
                    <div className="ui-overlay-panel__header">
                      <div className="ui-stack ui-stack--2xs">
                        <div className="ui-heading-4">Properties</div>
                        <div className="ui-text-secondary ui-text-small">
                          Selected node details and editable properties.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        onClick={() => setIsPropertiesOpen(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="ui-overlay-panel__body ui-scrollbar">
                      <NodeInspector
                        node={selectedNode}
                        onPropertyChange={(propertyId, value) => {
                          if (!workflowState.selectedNodeId) {
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
                  </aside>
                </div>
              ) : null}

              {isMobile && mobilePropertiesNode ? (
                <div className="ui-overlay-panel ui-overlay-panel--fullscreen ui-overlay-panel--open">
                  <div className="ui-overlay-panel__surface">
                    <div className="ui-overlay-panel__header">
                      <div className="ui-stack ui-stack--2xs">
                        <div className="ui-heading-4">{mobilePropertiesNode.title}</div>
                        <div className="ui-text-secondary ui-text-small">
                          Set properties for the selected node.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        onClick={() => setMobilePropertiesNodeId(undefined)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="ui-overlay-panel__body ui-scrollbar">
                      <NodePropertyEditor
                        fields={mobilePropertiesNode.properties}
                        disabled={!mobilePropertiesNode.isEnabled}
                        onPropertyChange={(propertyId, value) => {
                          workflowStore.updateNodeProperty(
                            mobilePropertiesNode.id,
                            propertyId,
                            value
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
