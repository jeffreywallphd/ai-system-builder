import { Link } from "react-router-dom";
import type { ContextNavigationModel } from "../../routes/ContextNavigation";

export interface ContextNavigationBarProps {
  readonly model: ContextNavigationModel;
}

export default function ContextNavigationBar({ model }: ContextNavigationBarProps): JSX.Element {
  return (
    <nav aria-label="Context" className="ui-card" data-testid="context-navigation-bar">
      <div className="ui-card__body ui-row ui-row--wrap" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <ol className="ui-row ui-row--wrap" style={{ listStyle: "none", margin: 0, padding: 0, gap: "0.5rem" }}>
          {model.breadcrumbs.map((crumb, index) => {
            const isLast = index === model.breadcrumbs.length - 1;
            return (
              <li key={crumb.key} className="ui-row ui-row--wrap" style={{ alignItems: "center", gap: "0.5rem" }}>
                {crumb.path && !isLast ? <Link to={crumb.path}>{crumb.label}</Link> : <span className={isLast ? "ui-text-secondary" : undefined}>{crumb.label}</span>}
                {!isLast ? <span className="ui-text-small ui-text-secondary">/</span> : null}
              </li>
            );
          })}
        </ol>
        {model.returnPath ? (
          <Link className="ui-button ui-button--ghost ui-button--small" to={model.returnPath}>Return to context</Link>
        ) : null}
      </div>
    </nav>
  );
}
