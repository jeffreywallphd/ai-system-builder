import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import "./PageStyles.css";

export default function NotFoundPage(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="page-card">
        <h1 className="page-title">Page Not Found</h1>
        <p className="page-subtitle">The route you requested does not exist.</p>
        <Link className="page-button page-button--primary" to={ROUTE_PATHS.home}>
          Return Home
        </Link>
      </div>
    </section>
  );
}
