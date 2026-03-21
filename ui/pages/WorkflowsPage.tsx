import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import WorkflowBrowser from "../components/workflow/WorkflowBrowser";
import WorkflowFormView from "../components/workflow/WorkflowFormView";
import PageTabs from "../components/navigation/PageTabs";
import { useUiDependencies } from "../composition/AppProviders";
import { buildInstalledModelOptions } from "../models/buildInstalledModelOptions";
import { WorkflowBrowserPresenter } from "../presenters/WorkflowBrowserPresenter";
import { WorkflowOutputPresenter } from "../presenters/WorkflowOutputPresenter";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { ContextStoreState } from "../state/ContextStore";
import type { IModelStoreState } from "../state/ModelStore";
import type { IWorkflowStoreState } from "../state/WorkflowStore";
import WorkflowEditorPage from "./WorkflowEditorPage";

type WorkflowsTabId = "find" | "create" | "execute";

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

export default function WorkflowsPage(): JSX.Element {
  const {
    workflowStore,
    settingsStore,
    workflowProjectionService,
    contextStore,
    modelStore,
    nodeStore,
    operationalStatus,
  } = useUiDependencies();
  const [workflowState, setWorkflowState] = useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [contextState, setContextState] = useState<ContextStoreState>(fallbackContextState);
  const [modelState, setModelState] = useState<IModelStoreState>(fallbackModelState);
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<WorkflowsTabId>("find");
  const browserPresenter = useMemo(() => new WorkflowBrowserPresenter(), []);
  const workflowOutputPresenter = useMemo(() => new WorkflowOutputPresenter(), []);

  useEffect(() => workflowStore.subscribe(setWorkflowState), [workflowStore]);
  useEffect(() => contextStore.subscribe(setContextState), [contextStore]);
  useEffect(() => modelStore.subscribe(setModelState), [modelStore]);
  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  useEffect(() => {
    void workflowStore.refreshWorkflows();
    void contextStore.initialize().catch(() => undefined);
    void modelStore.refreshInstalled().catch(() => undefined);
  }, [contextStore, modelStore, workflowStore]);

  const browserViewModel = useMemo(
    () => browserPresenter.present(workflowState.workflows, query),
    [browserPresenter, workflowState.workflows, query]
  );

  const currentWorkflow = workflowState.currentWorkflow;
  const canShowExecuteTab = (currentWorkflow?.nodes.length ?? 0) > 0;
  const formSchema = useMemo(
    () => (currentWorkflow ? workflowProjectionService.projectToForm(currentWorkflow) : undefined),
    [currentWorkflow, workflowProjectionService]
  );
  const workflowOutput = useMemo(
    () =>
      currentWorkflow
        ? workflowOutputPresenter.present(currentWorkflow, workflowState.outputAssets)
        : undefined,
    [currentWorkflow, workflowOutputPresenter, workflowState.outputAssets]
  );
  const availableModels = useMemo(
    () => buildInstalledModelOptions(modelState.installedModels),
    [modelState.installedModels]
  );

  useEffect(() => {
    if (activeTab === "execute" && !canShowExecuteTab) {
      setActiveTab(currentWorkflow ? "create" : "find");
    }
  }, [activeTab, canShowExecuteTab, currentWorkflow]);

  const openWorkflow = async (
    workflowId: string,
    destinationTab: Extract<WorkflowsTabId, "create" | "execute">
  ): Promise<void> => {
    await workflowStore.loadWorkflow(workflowId);
    setActiveTab(destinationTab);
  };

  const createNewWorkflow = async (): Promise<void> => {
    await workflowStore.createWorkflow({
      metadata: {
        name: "Untitled Workflow",
        description: "",
        tags: [],
      },
      validateOnCreate: false,
    });
    setActiveTab("create");
  };

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workflows</h1>
          <p className="ui-page__subtitle">
            Find saved flows, build new ones on the canvas, and run the selected flow from a task-focused execution view.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Workflow definitions are organized under <strong>{settingsState.settings.workspace.workflowsDirectory}</strong>. Update the path in{" "}
            <Link to={ROUTE_PATHS.settings}>Settings</Link> if your team stores projects elsewhere.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Persistence: <strong>{operationalStatus.workflowPersistence.effectiveMode}</strong>{" "}
            {operationalStatus.workflowPersistence.workflowsDirectory
              ? `(${operationalStatus.workflowPersistence.workflowsDirectory})`
              : ""}. Execution: <strong>{operationalStatus.execution.effectiveMode}</strong>.{" "}
            Catalog: <strong>{operationalStatus.nodeCatalog.effectiveMode}</strong>. MCP: <strong>{operationalStatus.mcp.effectiveMode}</strong>. Model library: <strong>{operationalStatus.modelLibrary.effectiveMode}</strong>.
          </p>
        </div>
      </div>

      <div className="ui-page__actions">
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--md"
          onClick={() => {
            void createNewWorkflow().catch(() => undefined);
          }}
        >
          New Workflow
        </button>
      </div>

      <PageTabs
        label="Workflow tabs"
        tabs={[
          {
            id: "find",
            label: "Find Flows",
            description: "Search and open saved workflows.",
          },
          {
            id: "create",
            label: "Create Flows",
            description: currentWorkflow ? "Edit the selected workflow on the canvas." : "Open or start a workflow to use the canvas.",
          },
          {
            id: "execute",
            label: "Execute Flows",
            description: "Run the selected workflow from a guided form.",
            isHidden: !canShowExecuteTab,
          },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as WorkflowsTabId)}
      />

      {workflowState.error ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <p className="ui-text-secondary">Unable to load workflows: {workflowState.error}</p>
          </div>
        </div>
      ) : null}

      <section
        id="page-tabpanel-find"
        role="tabpanel"
        aria-labelledby="page-tab-find"
        className="ui-page-tab-panel"
        hidden={activeTab !== "find"}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <WorkflowBrowser
              workflows={browserViewModel.results}
              query={browserViewModel.query}
              totalCount={browserViewModel.totalCount}
              isLoading={workflowState.isLoading}
              onQueryChange={setQuery}
              onLoadIntoCanvas={(workflowId) => {
                void openWorkflow(workflowId, "create").catch(() => undefined);
              }}
              onLoadIntoExecutor={(workflowId) => {
                void openWorkflow(workflowId, "execute").catch(() => undefined);
              }}
            />
          </div>
        </div>
      </section>

      <section
        id="page-tabpanel-create"
        role="tabpanel"
        aria-labelledby="page-tab-create"
        className="ui-page-tab-panel"
        hidden={activeTab !== "create"}
      >
        {currentWorkflow ? (
          <WorkflowEditorPage
            workflowStore={workflowStore}
            nodeStore={nodeStore}
            showHeader={false}
          />
        ) : (
          <div className="ui-card">
            <div className="ui-card__body ui-empty-state">
              <h2>Create Flows</h2>
              <p className="ui-text-secondary">
                Start a new workflow or load one from the Find Flows tab to open the canvas editor here.
              </p>
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--md"
                onClick={() => {
                  void createNewWorkflow().catch(() => undefined);
                }}
              >
                Start a new workflow
              </button>
            </div>
          </div>
        )}
      </section>

      <section
        id="page-tabpanel-execute"
        role="tabpanel"
        aria-labelledby="page-tab-execute"
        className="ui-page-tab-panel"
        hidden={activeTab !== "execute"}
      >
        {currentWorkflow && formSchema && workflowOutput ? (
          <div className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--md">
              <div className="ui-row ui-row--between ui-row--wrap">
                <div className="ui-stack ui-stack--2xs">
                  <h2>{currentWorkflow.metadata.name}</h2>
                  <p className="ui-text-secondary">
                    Fill in the workflow inputs below, then execute the flow without leaving the workflows page.
                  </p>
                </div>

                <div className="ui-row ui-row--wrap">
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    onClick={() => setActiveTab("create")}
                  >
                    Back to Canvas
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    disabled={workflowState.isExecuting}
                    onClick={() => {
                      void workflowStore.executeCurrentWorkflow().catch(() => undefined);
                    }}
                  >
                    {workflowState.isExecuting ? "Executing…" : "Execute Flow"}
                  </button>
                </div>
              </div>

              <WorkflowFormView
                schema={formSchema}
                output={workflowOutput}
                availableContextPackages={contextState.packages}
                availableContextRecipes={contextState.recipes}
                availableModels={availableModels}
                onChange={(fieldId, value) => {
                  workflowStore.applyFormInput({ [fieldId]: value });
                }}
              />

              {workflowState.lastExecutionEvent ? (
                <div className="ui-card">
                  <div className="ui-card__body">
                    <p className="ui-text-secondary">
                      Last run status: <strong>{workflowState.lastExecutionEvent.status}</strong>
                      {workflowState.lastExecutionEvent.message
                        ? ` — ${workflowState.lastExecutionEvent.message}`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        ) : (
          <div className="ui-card">
            <div className="ui-card__body ui-empty-state">
              <h2>Execute Flows</h2>
              <p className="ui-text-secondary">
                Load a workflow with at least one node to run it from this guided execution tab.
              </p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
