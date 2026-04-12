import type { RuntimeConsoleTab } from "../../state/RuntimeConsoleStore";

export interface RuntimeConsoleToolbarProps {
  readonly isExpanded: boolean;
  readonly activeTab: RuntimeConsoleTab;
  readonly logCount: number;
  readonly onToggle: () => void;
  readonly onClearLogs: () => void;
  readonly onSelectTab: (tab: RuntimeConsoleTab) => void;
}

export default function RuntimeConsoleToolbar({
  isExpanded,
  activeTab,
  logCount,
  onToggle,
  onClearLogs,
  onSelectTab,
}: RuntimeConsoleToolbarProps): JSX.Element {
  return (
    <div className="ui-runtime-console__toolbar">
      <button className="ui-button ui-button--ghost ui-button--sm ui-runtime-console__toolbar-button" type="button" onClick={onToggle}>
        {isExpanded ? "Hide Runtime Console" : "Show Runtime Console"}
      </button>
      {isExpanded ? (
        <div className="ui-runtime-console__tabs" role="tablist" aria-label="Runtime console tabs">
          <button
            className={`ui-button ui-button--sm ui-runtime-console__tab${activeTab === "health" ? " ui-button--secondary ui-runtime-console__tab--active" : " ui-button--ghost"}`}
            type="button"
            onClick={() => onSelectTab("health")}
            role="tab"
            aria-selected={activeTab === "health"}
          >
            Health
          </button>
          <button
            className={`ui-button ui-button--sm ui-runtime-console__tab${activeTab === "logs" ? " ui-button--secondary ui-runtime-console__tab--active" : " ui-button--ghost"}`}
            type="button"
            onClick={() => onSelectTab("logs")}
            role="tab"
            aria-selected={activeTab === "logs"}
          >
            Logs
          </button>
        </div>
      ) : null}
      <span className="ui-runtime-console__count">{logCount} logs</span>
      <button className="ui-button ui-button--ghost ui-button--sm ui-runtime-console__toolbar-button" type="button" onClick={onClearLogs}>
        Clear logs
      </button>
    </div>
  );
}
