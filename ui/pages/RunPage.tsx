import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";

export default function RunPage(): JSX.Element {
  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="run-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Run</h1>
          <p className="ui-page__subtitle">
            Centralized execution entry for running and monitoring assets. Use existing run surfaces while this intent shell evolves.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2 style={{ margin: 0 }}>Run surfaces</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>
            This bounded Run shell links to current execution tooling without exposing runtime internals in primary navigation.
          </p>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
            <Link className="ui-button ui-button--primary ui-button--sm" to={ROUTE_PATHS.tools}>Open tool runs</Link>
            <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.systemStudio}>Open system studio</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
