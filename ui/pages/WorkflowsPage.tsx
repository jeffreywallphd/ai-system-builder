import { Link } from "react-router-dom";

export default function WorkflowsPage(): JSX.Element {
  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workflows</h1>
          <p className="ui-page__subtitle">
            Manage and open saved workflows.
          </p>
        </div>

        <div className="ui-page__actions">
          <Link className="ui-button ui-button--primary ui-button--md" to="/workflows/new">
            New Workflow
          </Link>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body">
          <p className="ui-text-secondary">
            This page will host the workflow library, search, and creation actions.
          </p>
        </div>
      </div>
    </section>
  );
}
