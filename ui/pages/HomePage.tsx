import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";

export default function HomePage(): JSX.Element {
  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">AI Loom Studio</h1>
          <p className="ui-page__subtitle">
            Build and orchestrate AI workflows through a clean, guided interface.
          </p>
        </div>

        <div className="ui-page__actions">
          <Link className="ui-button ui-button--primary ui-button--md" to={ROUTE_PATHS.workflows}>
            Open Workflows
          </Link>
          <Link className="ui-button ui-button--secondary ui-button--md" to={ROUTE_PATHS.models}>
            Browse Models
          </Link>
        </div>
      </div>

      <div className="ui-page-grid ui-page-grid--3">
        <article className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <h2 className="ui-heading-4">Workflows</h2>
            <p className="ui-text-secondary">
              Create, edit, validate, and execute workflow graphs.
            </p>
          </div>
        </article>

        <article className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <h2 className="ui-heading-4">Models</h2>
            <p className="ui-text-secondary">
              Search remote catalogs, install models, and manage compatibility.
            </p>
          </div>
        </article>

        <article className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <h2 className="ui-heading-4">Assets</h2>
            <p className="ui-text-secondary">
              Track generated outputs and supporting artifacts across executions.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
