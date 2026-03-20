import ToolCard from "./ToolCard";

export default function ToolBrowser({
  tools,
}: {
  readonly tools: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly description?: string;
    readonly category?: string;
    readonly typeId: string;
    readonly typeLabel: string;
  }>;
}): JSX.Element {
  if (tools.length === 0) {
    return (
      <div className="ui-card">
        <div className="ui-card__body ui-empty-state">No tools matched your current search.</div>
      </div>
    );
  }

  return <div className="ui-stack">{tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>;
}
