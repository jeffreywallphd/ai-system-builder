import { Link } from "react-router-dom";

export default function ToolCard({
  tool,
}: {
  readonly tool: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly category?: string;
    readonly typeLabel: string;
  };
}): JSX.Element {
  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--xs">
        <div className="ui-row ui-row--between ui-row--wrap">
          <h3>{tool.title}</h3>
          <span className="ui-badge ui-badge--info">{tool.typeLabel}</span>
        </div>
        {tool.description ? <p>{tool.description}</p> : null}
        <Link to={`/tools/${tool.id}`} className="ui-button ui-button--sm ui-button--primary">
          Open
        </Link>
      </div>
    </div>
  );
}
