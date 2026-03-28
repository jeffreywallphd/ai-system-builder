import { Link } from "react-router-dom";
import type { ContextualRecommendation } from "../../routes/ContextualRecommendations";

export interface ContextualRecommendationsPanelProps {
  readonly title?: string;
  readonly recommendations: ReadonlyArray<ContextualRecommendation>;
}

export default function ContextualRecommendationsPanel({
  title = "Recommended next actions",
  recommendations,
}: ContextualRecommendationsPanelProps): JSX.Element | null {
  if (recommendations.length <= 0) {
    return null;
  }

  return (
    <section className="ui-card" data-testid="contextual-recommendations-panel">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>
            Suggested next steps based on your current context.
          </p>
        </div>
        <div className="ui-stack ui-stack--xs">
          {recommendations.map((entry) => (
            <Link
              key={entry.id}
              className="ui-button ui-button--ghost ui-button--small"
              style={{ justifyContent: "space-between" }}
              to={entry.action.launchPath}
            >
              <span>{entry.label}</span>
              <span className="ui-text-small ui-text-secondary">{entry.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
