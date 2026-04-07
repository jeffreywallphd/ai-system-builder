import { Link } from "react-router-dom";
import type { ContextNavigationModel } from "../../routes/ContextNavigation";

export interface ContextNavigationBarProps {
  readonly model: ContextNavigationModel;
}

export default function ContextNavigationBar({ model }: ContextNavigationBarProps): JSX.Element {
  return (
    <nav aria-label="Context" className="ui-context-nav" data-testid="context-navigation-bar">
      <div className="ui-context-nav__content">
        <ol className="ui-context-nav__breadcrumbs">
          {model.breadcrumbs.map((crumb, index) => {
            const isLast = index === model.breadcrumbs.length - 1;
            return (
              <li key={crumb.key} className="ui-context-nav__crumb">
                {crumb.path && !isLast ? <Link to={crumb.path}>{crumb.label}</Link> : <span className={isLast ? "ui-text-secondary" : undefined}>{crumb.label}</span>}
                {!isLast ? <span className="ui-text-small ui-text-secondary">/</span> : null}
              </li>
            );
          })}
        </ol>
        {model.returnPath ? (
          <Link className="ui-button ui-button--ghost ui-button--sm" to={model.returnPath}>Return to context</Link>
        ) : null}
      </div>
    </nav>
  );
}
