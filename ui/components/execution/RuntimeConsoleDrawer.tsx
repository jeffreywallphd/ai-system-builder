import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import type { RuntimeConsoleLogEntry, RuntimeConsoleTab, RuntimeHealthCheck } from "../../state/RuntimeConsoleStore";
import RuntimeConsoleToolbar from "./RuntimeConsoleToolbar";
import RuntimeHealthList from "./RuntimeHealthList";
import RuntimeLogsList from "./RuntimeLogsList";

export interface RuntimeConsoleDrawerProps {
  readonly isExpanded: boolean;
  readonly activeTab: RuntimeConsoleTab;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshingHealth?: boolean;
  readonly onToggleExpanded: () => void;
  readonly onClearLogs: () => void;
  readonly onRefreshHealth: () => void;
  readonly onSelectTab: (tab: RuntimeConsoleTab) => void;
}

export default function RuntimeConsoleDrawer({
  isExpanded,
  activeTab,
  events,
  logs,
  healthChecks,
  isRefreshingHealth = false,
  onToggleExpanded,
  onClearLogs,
  onRefreshHealth,
  onSelectTab,
}: RuntimeConsoleDrawerProps): JSX.Element {
  const logCount = Math.max(logs.length, events.length);

  return (
    <section className={`ui-runtime-console${isExpanded ? " ui-runtime-console--expanded" : ""}`}>
      <RuntimeConsoleToolbar
        isExpanded={isExpanded}
        activeTab={activeTab}
        logCount={logCount}
        onToggle={onToggleExpanded}
        onClearLogs={onClearLogs}
        onSelectTab={onSelectTab}
      />
      {isExpanded ? (
        activeTab === "health" ? (
          <RuntimeHealthList
            healthChecks={healthChecks}
            isRefreshing={isRefreshingHealth}
            onRefresh={onRefreshHealth}
          />
        ) : (
          <RuntimeLogsList logs={logs} />
        )
      ) : null}
    </section>
  );
}
