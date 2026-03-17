import ToolCard from "./ToolCard";

export default function ToolBrowser({ tools }: { readonly tools: ReadonlyArray<{ readonly id: string; readonly title: string; readonly description?: string; readonly category?: string }> }): JSX.Element {
  return <div className="ui-stack">{tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>;
}
