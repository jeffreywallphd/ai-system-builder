import { Link } from "react-router-dom";
import type { WorkflowListItemViewModel } from "../../presenters/WorkflowPresenter";
import { ROUTE_PATHS } from "../../routes/RouteConfig";

export interface WorkflowBrowserProps {
  readonly workflows: ReadonlyArray<WorkflowListItemViewModel>;
  readonly query: string;
  readonly totalCount: number;
  readonly isLoading?: boolean;
  readonly onQueryChange: (query: string) => void;
}

export default function WorkflowBrowser({
  workflows,
  query,
  totalCount,
  isLoading = false,
  onQueryChange,
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

                <Link
                  className="ui-button ui-button--primary ui-button--sm"
                  to={ROUTE_PATHS.workflowEditor.replace(":workflowId", workflow.id)}
                >
                  Load into Canvas
                </Link>
              </div>

              {workflow.description ? (
                <p className="ui-text-secondary">{workflow.description}</p>
              ) : null}
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
