import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import WorkflowBrowser from "../components/workflow/WorkflowBrowser";
import { useUiDependencies } from "../composition/AppProviders";
import { WorkflowBrowserPresenter } from "../presenters/WorkflowBrowserPresenter";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { IWorkflowStoreState } from "../state/WorkflowStore";

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
  nodeExecutionOutputs: Object.freeze({}),
  error: undefined,
});

export default function WorkflowsPage(): JSX.Element {
  const { workflowStore } = useUiDependencies();
  const [workflowState, setWorkflowState] =
    useState<IWorkflowStoreState>(fallbackWorkflowState);
  const [query, setQuery] = useState("");
  const browserPresenter = useMemo(() => new WorkflowBrowserPresenter(), []);

  useEffect(() => workflowStore.subscribe(setWorkflowState), [workflowStore]);

  useEffect(() => {
    void workflowStore.refreshWorkflows();
  }, [workflowStore]);

  const browserViewModel = useMemo(
    () => browserPresenter.present(workflowState.workflows, query),
    [browserPresenter, workflowState.workflows, query]
  );

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workflows</h1>
          <p className="ui-page__subtitle">Manage and open saved workflows.</p>
        </div>

        <div className="ui-page__actions">
          <Link className="ui-button ui-button--primary ui-button--md" to={`${ROUTE_PATHS.workflows}/new`}>
            New Workflow
          </Link>
        </div>
      </div>

      {workflowState.error ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <p className="ui-text-secondary">Unable to load workflows: {workflowState.error}</p>
          </div>
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__body">
          <WorkflowBrowser
            workflows={browserViewModel.results}
            query={browserViewModel.query}
            totalCount={browserViewModel.totalCount}
            isLoading={workflowState.isLoading}
            onQueryChange={setQuery}
          />
        </div>
      </div>
    </section>
  );
}
