import type { WorkflowListItemViewModel } from "../../presenters/WorkflowPresenter";

export interface WorkflowBrowserProps {
  readonly workflows: ReadonlyArray<WorkflowListItemViewModel>;
  readonly query: string;
  readonly totalCount: number;
  readonly isLoading?: boolean;
  readonly onQueryChange: (query: string) => void;
  readonly onLoadIntoCanvas?: (workflowId: string) => void;
  readonly onLoadIntoExecutor?: (workflowId: string) => void;
}

export default function WorkflowBrowser({
  workflows,
  query,
  totalCount,
  isLoading = false,
  onQueryChange,
  onLoadIntoCanvas,
  onLoadIntoExecutor,
}: WorkflowBrowserProps): JSX.Element {
  return (
    <div className="ui-stack ui-stack--md">
      <div className="ui-field">
        <label className="ui-field__label" htmlFor="workflow-search">
          Search workflows
        </label>
        <input
          id="workflow-search"
          type="search"
          className="ui-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, description, or id"
        />
      </div>

      <div className="ui-text-secondary" role="status" aria-live="polite">
        {isLoading
          ? "Loading workflows..."
          : `${workflows.length} of ${totalCount} workflow${totalCount === 1 ? "" : "s"}`}
      </div>

      <div className="ui-stack ui-stack--sm">
        {workflows.map((workflow) => (
          <article className="ui-card" key={workflow.id}>
            <div className="ui-card__body ui-stack ui-stack--sm">
              <div className="ui-row ui-row--between ui-row--wrap">
                <div className="ui-stack ui-stack--2xs">
                  <strong>{workflow.title}</strong>
                  <span className="ui-text-secondary">{workflow.id}</span>
                </div>

                <div className="ui-row ui-row--wrap">
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    onClick={() => onLoadIntoCanvas?.(workflow.id)}
                  >
                    Load into Canvas
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    disabled={workflow.nodeCount === 0}
                    onClick={() => onLoadIntoExecutor?.(workflow.id)}
                  >
                    Load into Executor
                  </button>
                </div>
              </div>

              {workflow.description ? (
                <p className="ui-text-secondary">{workflow.description}</p>
              ) : null}

              <div className="ui-row ui-row--wrap ui-text-small ui-text-secondary">
                <span>{workflow.nodeCount} node{workflow.nodeCount === 1 ? "" : "s"}</span>
                <span>{workflow.connectionCount} connection{workflow.connectionCount === 1 ? "" : "s"}</span>
                <span>{workflow.isExecutable ? "Ready to run" : "Needs setup"}</span>
              </div>
            </div>
          </article>
        ))}

        {!isLoading && workflows.length === 0 ? (
          <div className="ui-card">
            <div className="ui-card__body">
              <p className="ui-text-secondary">
                {totalCount === 0
                  ? "No saved workflows were found in the current repository."
                  : "No workflows match your search."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
