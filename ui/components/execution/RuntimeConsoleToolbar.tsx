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
      <button className="ui-button ui-button--ghost ui-button--sm" type="button" onClick={onToggle}>
        {isExpanded ? "Hide Runtime Console" : "Show Runtime Console"}
      </button>
      {isExpanded ? (
        <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-2xs)" }}>
          <button
            className={`ui-button ui-button--sm${activeTab === "health" ? " ui-button--secondary" : " ui-button--ghost"}`}
            type="button"
            onClick={() => onSelectTab("health")}
          >
            Health
          </button>
          <button
            className={`ui-button ui-button--sm${activeTab === "logs" ? " ui-button--secondary" : " ui-button--ghost"}`}
            type="button"
            onClick={() => onSelectTab("logs")}
          >
            Logs
          </button>
        </div>
      ) : null}
      <span className="ui-runtime-console__count">{logCount} logs</span>
      <button className="ui-button ui-button--ghost ui-button--sm" type="button" onClick={onClearLogs}>
        Clear logs
      </button>
    </div>
  );
}
