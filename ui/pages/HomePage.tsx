import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import "./PageStyles.css";

export default function HomePage(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <h1 className="page-title">AI Loom Studio</h1>
          <p className="page-subtitle">
            Build and orchestrate AI workflows through a clean, guided interface.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="page-button page-button--primary"
            to={ROUTE_PATHS.workflows}
          >
            Open Workflows
          </Link>
          <Link className="page-button" to={ROUTE_PATHS.models}>
            Browse Models
          </Link>
        </div>
      </div>

      <div className="page-grid">
        <article className="page-card">
          <h2>Workflows</h2>
          <p>Create, edit, validate, and execute workflow graphs.</p>
        </article>

        <article className="page-card">
          <h2>Models</h2>
          <p>Search remote catalogs, install models, and manage compatibility.</p>
        </article>

        <article className="page-card">
          <h2>Assets</h2>
          <p>Track generated outputs and supporting artifacts across executions.</p>
        </article>
      </div>
    </section>
  );
}
