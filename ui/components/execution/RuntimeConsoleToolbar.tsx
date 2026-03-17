export interface RuntimeConsoleToolbarProps {
  readonly isExpanded: boolean;
  readonly eventCount: number;
  readonly onToggle: () => void;
  readonly onClear: () => void;
}

export default function RuntimeConsoleToolbar({
  isExpanded,
  eventCount,
  onToggle,
  onClear,
}: RuntimeConsoleToolbarProps): JSX.Element {
  return (
    <div className="ui-runtime-console__toolbar">
      <button className="ui-button ui-button--ghost ui-button--sm" type="button" onClick={onToggle}>
        {isExpanded ? "Hide Runtime Console" : "Show Runtime Console"}
      </button>
      <span className="ui-runtime-console__count">{eventCount} events</span>
      <button className="ui-button ui-button--ghost ui-button--sm" type="button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
