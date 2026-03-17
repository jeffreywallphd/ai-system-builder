import { Link } from "react-router-dom";

export default function ToolCard({ tool }: { readonly tool: { readonly id: string; readonly title: string; readonly description?: string; readonly category?: string } }): JSX.Element {
  return <div className="ui-card"><div className="ui-card__body ui-stack ui-stack--xs"><h3>{tool.title}</h3>{tool.description ? <p>{tool.description}</p> : null}<Link to={`/tools/${tool.id}`} className="ui-button ui-button--sm ui-button--primary">Open</Link></div></div>;
}
