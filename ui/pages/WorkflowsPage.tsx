import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import "./PageStyles.css";

export default function WorkflowsPage(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">Manage and open saved workflows.</p>
        </div>

        <div className="page-actions">
          <Link
            className="page-button page-button--primary"
            to={ROUTE_PATHS.workflowEditor.replace(":workflowId", "new")}
          >
            New Workflow
          </Link>
        </div>
      </div>

      <div className="page-card">
        <p>This page will host the workflow library, search, and creation actions.</p>
      </div>
    </section>
  );
}
