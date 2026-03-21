import { useEffect, useMemo, useRef, useState } from "react";
import { generatePath, useParams } from "react-router-dom";
import NodePalette from "../components/nodes/NodePalette";
import NodeInspector from "../components/nodes/NodeInspector";
import NodePropertyEditor from "../components/nodes/NodePropertyEditor";
import ConnectionInspector from "../components/workflow/ConnectionInspector";
import WorkflowExecutionStatusPanel from "../components/execution/WorkflowExecutionStatusPanel";
import WorkflowCanvas from "../components/workflow/WorkflowCanvas";
import WorkflowCanvasToolbar from "../components/workflow/WorkflowCanvasToolbar";
import WorkflowMetadataPanel from "../components/workflow/WorkflowMetadataPanel";
import WorkflowValidationPanel from "../components/workflow/WorkflowValidationPanel";
import WorkflowFormView from "../components/workflow/WorkflowFormView";
import WorkflowOutputViewer from "../components/workflow/WorkflowOutputViewer";
import type { WorkflowViewMode } from "../state/WorkflowViewMode";
import { useUiDependencies } from "../composition/AppProviders";
import { NodePresenter } from "../presenters/NodePresenter";
import { WorkflowPresenter } from "../presenters/WorkflowPresenter";
import { WorkflowOutputPresenter } from "../presenters/WorkflowOutputPresenter";
import { ValidationPresenter } from "../presenters/ValidationPresenter";
import { NodeStore, type INodeStoreState } from "../state/NodeStore";
import { WorkflowStore, type IWorkflowStoreState } from "../state/WorkflowStore";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { IModelStoreState } from "../state/ModelStore";
import { buildInstalledModelOptions } from "../models/buildInstalledModelOptions";
import type { ContextStoreState } from "../state/ContextStore";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";

export interface WorkflowEditorPageProps {
  readonly workflowStore?: WorkflowStore;
  readonly nodeStore?: NodeStore;
  readonly showHeader?: boolean;
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
  lastSavedAt: undefined,
  saveError: undefined,
  actionHistory: Object.freeze({
    entries: Object.freeze([]),
    canUndo: false,
    canRedo: false,
  }),
  isExecuting: false,
  lastExecutionEvent: undefined,
  nodeExecutionOutputs: Object.freeze({}),
  outputAssets: Object.freeze([]),
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

const fallbackContextState: ContextStoreState = Object.freeze({
  packages: Object.freeze([]),
  recipes: Object.freeze([]),
  selectedPackageId: undefined,
  selectedPackage: undefined,
  searchQuery: "",
  searchTags: Object.freeze([]),
  isLoadingList: false,
  isLoadingSelected: false,
  isMutating: false,
  error: undefined,
});

const fallbackModelState: IModelStoreState = Object.freeze({
  installedModels: Object.freeze([]),
  remoteModels: Object.freeze([]),
  selectedInstalledModelId: undefined,
  selectedRemoteModelId: undefined,
  installedSearchCriteria: undefined,
  remoteSearchCriteria: undefined,
  installProgressByModelId: Object.freeze({}),
  isLoadingInstalled: false,
  isSearchingRemote: false,
  isInstalling: false,
  isRemoving: false,
  error: undefined,
});

const mobileQuery = "(max-width: 767px)";

function getContextInspection(output: Readonly<Record<string, unknown>> | undefined) {
  const inspection = output?.inspection;

  if (!inspection || typeof inspection !== "object") {
    return undefined;
  }

  return inspection as import("../../application/context/models/ContextInspectionResult").ContextInspectionResult;
}

export default function WorkflowEditorPage({
  workflowStore: workflowStoreProp,
  nodeStore: nodeStoreProp,
  showHeader = true,
}: WorkflowEditorPageProps): JSX.Element {
  const {
    workflowStore: injectedWorkflowStore,
    nodeStore: injectedNodeStore,
    contextStore,
    workflowProjectionService,
    settingsStore,
    modelStore,
    runtimeConsoleStore,
  } = useUiDependencies();

  const workflowStore = workflowStoreProp ?? injectedWorkflowStore;
  const nodeStore = nodeStoreProp ?? injectedNodeStore;

  const { workflowId } = useParams<{ workflowId: string }>();

  const [workflowState, setWorkflowState] =
    useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [nodeState, setNodeState] = useState<INodeStoreState>(fallbackNodeState);
  const [contextState, setContextState] = useState<ContextStoreState>(fallbackContextState);
  const [modelState, setModelState] = useState<IModelStoreState>(fallbackModelState);
  const [runtimeState, setRuntimeState] = useState<RuntimeConsoleState>(() => runtimeConsoleStore.getState());
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());
  const authoringSettings = settingsState.settings.authoring;
  const [fitViewNonce, setFitViewNonce] = useState(0);
  const [viewMode, setViewMode] = useState<WorkflowViewMode>(authoringSettings.defaultWorkflowViewMode);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(authoringSettings.openNodePaletteByDefault);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(authoringSettings.openInspectorByDefault);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(authoringSettings.openOutputsByDefault);
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
  const workflowOutputPresenter = useMemo(() => new WorkflowOutputPresenter(), []);
  const validationPresenter = useMemo(() => new ValidationPresenter(), []);

  const createdNewWorkflowRef = useRef(false);

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

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);
  useEffect(() => modelStore.subscribe(setModelState), [modelStore]);
  useEffect(() => runtimeConsoleStore.subscribe(setRuntimeState), [runtimeConsoleStore]);

  useEffect(() => {
    return contextStore.subscribe(setContextState);
  }, [contextStore]);

  useEffect(() => {
    void nodeStore.refreshCatalog();
  }, [nodeStore]);

  useEffect(() => {
    void contextStore.initialize().catch(() => undefined);
  }, [contextStore]);

  useEffect(() => {
    void modelStore.refreshInstalled().catch(() => undefined);
  }, [modelStore]);

  useEffect(() => {
    const existingWorkflow = workflowStore.getState().currentWorkflow;

    if (workflowId && workflowId !== "new") {
      createdNewWorkflowRef.current = false;

      if (existingWorkflow?.id === workflowId) {
        return;
      }

      void workflowStore.loadWorkflow(workflowId);
      return;
    }

    if (workflowId === "new") {
      if (!createdNewWorkflowRef.current) {
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

  const formSchema = useMemo(() => {
    if (!currentWorkflow) {
      return undefined;
    }
    return workflowProjectionService.projectToForm(currentWorkflow);
  }, [currentWorkflow, workflowProjectionService]);

  const selectedNode = editorViewModel?.selectedNode;

  const workflowOutput = useMemo(() => {
    if (!currentWorkflow) {
      return undefined;
    }

    return workflowOutputPresenter.present(currentWorkflow, workflowState.outputAssets);
  }, [currentWorkflow, workflowOutputPresenter, workflowState.outputAssets]);

  const contextWorkbenchHref = useMemo(() => {
    if (!currentWorkflow) {
      return undefined;
    }

    return generatePath(ROUTE_PATHS.workflowContextWorkbench, { workflowId: currentWorkflow.id });
  }, [currentWorkflow]);

  const selectedNodeExecutionOutput = selectedNode
    ? workflowState.nodeExecutionOutputs[selectedNode.id]
    : undefined;

  const selectedContextInspection = useMemo(
    () => getContextInspection(selectedNodeExecutionOutput),
    [selectedNodeExecutionOutput]
  );

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
  const availableModels = useMemo(() => buildInstalledModelOptions(modelState.installedModels), [modelState.installedModels]);
  const validateButtonLabel = useMemo(() => {
    if (!workflowState.validation) {
      return "Validate";
    }

    if (workflowState.validation.isValid) {
      return "Validated";
    }

    const issueCount = workflowState.validation.messages.length;
    return `${issueCount} Issue${issueCount === 1 ? "" : "s"}`;
  }, [workflowState.validation]);
  const executeButtonLabel = useMemo(() => {
    if (runtimeState.appState === "starting") {
      return "Starting runtime…";
    }

    if (runtimeState.appState === "reconnecting") {
      return "Reconnecting runtime…";
    }

    if (workflowState.isExecuting) {
      return "Executing…";
    }

    switch (workflowState.lastExecutionEvent?.status) {
      case "completed":
        return "Executed";
      case "failed":
        return "Retry Execute";
      case "cancelled":
        return "Execute Cancelled";
      default:
        return "Execute";
    }
  }, [runtimeState.appState, workflowState.isExecuting, workflowState.lastExecutionEvent?.status]);
  const canExecuteWorkflow = editorViewModel?.header.isExecutable && runtimeState.appState === "ready";
  const workflowStatusMessage = useMemo(() => {
    if (runtimeState.appState !== "ready") {
      return runtimeState.appStateDetail;
    }

    if (workflowState.saveError) {
      return workflowState.saveError;
    }

    if (workflowState.isSaving) {
      return "Saving workflow changes automatically…";
    }

    if (workflowState.isExecuting) {
      return workflowState.lastExecutionEvent?.message ?? "Workflow execution is running.";
    }

    if (workflowState.lastExecutionEvent?.status === "completed") {
      return workflowState.lastExecutionEvent.message ?? "Workflow execution completed successfully.";
    }

    if (workflowState.lastExecutionEvent?.status === "failed") {
      return workflowState.lastExecutionEvent.message ?? "Workflow execution failed.";
    }

    if (workflowState.validation?.isValid) {
      return "Workflow validation passed.";
    }

    if (workflowState.validation && !workflowState.validation.isValid) {
      return `${workflowState.validation.messages.length} validation issue${
        workflowState.validation.messages.length === 1 ? "" : "s"
      } still need attention.`;
    }

    if (workflowState.lastSavedAt) {
      return `Workflow auto-saved at ${new Date(workflowState.lastSavedAt).toLocaleTimeString()}.`;
    }

    return undefined;
  }, [
    workflowState.lastSavedAt,
    workflowState.saveError,
    workflowState.isSaving,
    workflowState.isExecuting,
    workflowState.lastExecutionEvent?.message,
    workflowState.lastExecutionEvent?.status,
    workflowState.validation,
    runtimeState.appState,
    runtimeState.appStateDetail,
  ]);

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
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    setIsCanvasLocked((current) => !current);
  };

  return (
    <section
      className={`ui-page ui-page--editor${
        isCanvasLocked ? " ui-page--editor-canvas-locked" : ""
      }`}
    >
      {showHeader && !isCanvasLocked ? (
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
      ) : null}

      {(workflowState.error || nodeState.error) && !isCanvasLocked ? (
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

      {runtimeState.appState !== "ready" && !isCanvasLocked ? (
        <div className="ui-card">
          <div className="ui-card__body ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
            <div className="ui-stack ui-stack--2xs">
              <strong>Runtime {runtimeState.appState}</strong>
              <span className="ui-text-secondary ui-text-small">{runtimeState.appStateDetail}</span>
            </div>
            <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => runtimeConsoleStore.openConsole("logs")}
              >
                View logs
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                disabled={!runtimeState.canRestartRuntime || runtimeState.isRestartingRuntime}
                onClick={() => void runtimeConsoleStore.restartRuntime().catch(() => undefined)}
              >
                {runtimeState.isRestartingRuntime ? "Restarting…" : "Restart runtime"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ui-workspace">
        <div className="ui-workspace__main">
          <div className="ui-canvas-shell">
            <WorkflowCanvasToolbar
              viewMode={viewMode}
              isMobile={isMobile}
              hasSelection={hasSelection}
              canOpenProperties={!!selectedNode}
              isCanvasLocked={isCanvasLocked}
              canExecuteWorkflow={canExecuteWorkflow}
              isExecutingWorkflow={workflowState.isExecuting}
              validateLabel={validateButtonLabel}
              executeLabel={executeButtonLabel}
              workflowStatusMessage={workflowStatusMessage}
              isMenuOpen={isLeftMenuOpen}
              isPropertiesOpen={isPropertiesOpen}
              canToggleOutput={!!workflowOutput}
              isOutputOpen={isOutputOpen}
              onToggleCanvasLock={toggleCanvasLock}
              onExecuteWorkflow={() => {
                void workflowStore.executeCurrentWorkflow();
              }}
              onOpenMenu={() => {
                setIsLeftMenuOpen((value) => !value);
              }}
              onOpenProperties={() => {
                if (selectedNode) {
                  setIsPropertiesOpen((value) => !value);
                }
              }}
              onToggleOutput={() => {
                setIsOutputOpen((value) => !value);
              }}
              onClearSelection={() => workflowStore.clearSelection()}
              onValidateWorkflow={() => workflowStore.validateCurrentWorkflow()}
              onViewModeChange={setViewMode}
            />

            <div className="ui-canvas-shell__body">
              <div
                className={`ui-canvas-shell__view ${
                  viewMode === "canvas" ? "ui-canvas-shell__view--active" : "ui-canvas-shell__view--inactive"
                }`}
              >
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
                  onResolveNodePlacement={(nodeId, position) => {
                    return workflowStore.previewNodeMovePlacement(nodeId, position);
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
                  onRemoveNode={(nodeId) => {
                    workflowStore.removeNode(nodeId);
                  }}
                  nodeExecutionOutputs={workflowState.nodeExecutionOutputs}
                />
              </div>

              <div
                className={`ui-canvas-shell__view ${
                  viewMode === "form" ? "ui-canvas-shell__view--active" : "ui-canvas-shell__view--inactive"
                }`}
              >
                {formSchema && workflowOutput ? (
                  <WorkflowFormView
                    schema={formSchema}
                    output={workflowOutput}
                    availableContextPackages={contextState.packages}
                    availableContextRecipes={contextState.recipes}
                    onChange={(fieldId, value) => {
                      workflowStore.applyFormInput({ [fieldId]: value });
                    }}
                    availableModels={availableModels}
                  />
                ) : null}
              </div>


              {viewMode === "canvas" && isOutputOpen && workflowOutput ? (
                <div className="ui-overlay-panel ui-overlay-panel--bottom ui-overlay-panel--open">
                  <button
                    type="button"
                    className="ui-overlay-panel__scrim"
                    aria-label="Hide output"
                    onClick={() => setIsOutputOpen(false)}
                  />

                  <aside className="ui-overlay-panel__surface">
                    <div className="ui-overlay-panel__header">
                      <div className="ui-stack ui-stack--2xs">
                        <div className="ui-heading-4">Workflow Output</div>
                        <div className="ui-text-secondary ui-text-small">
                          Latest generated outputs and expected output types.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        onClick={() => setIsOutputOpen(false)}
                      >
                        Hide Output
                      </button>
                    </div>

                    <div className="ui-overlay-panel__body ui-scrollbar">
                      <WorkflowOutputViewer output={workflowOutput} mode="canvas" />
                    </div>
                  </aside>
                </div>
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
                      contextWorkbenchHref={contextWorkbenchHref}
                      isSaving={workflowState.isSaving}
                      isExecuting={workflowState.isExecuting}
                      canExecuteWorkflow={canExecuteWorkflow}
                      validateLabel={validateButtonLabel}
                      executeLabel={executeButtonLabel}
                      workflowStatusMessage={workflowStatusMessage}
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
                        contextInspection={selectedContextInspection}
                        availableModels={availableModels}
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
                        availableModels={availableModels}
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
