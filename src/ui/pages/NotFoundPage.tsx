import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";

export default function NotFoundPage(): JSX.Element {
  return (
    <section className="ui-page">
      <div className="ui-card">
        <div className="ui-card__body ui-empty-state">
          <div className="ui-stack ui-stack--xs">
            <h1 className="ui-page__title">Page Not Found</h1>
            <p className="ui-page__subtitle">
              The route you requested does not exist.
            </p>
          </div>

          <Link className="ui-button ui-button--primary ui-button--md" to={ROUTE_PATHS.home}>
            Return Home
          </Link>
        </div>
      </div>
    </section>
  );
}
