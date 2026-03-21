import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import { useState } from "react";
import type { RuntimeConsoleLogEntry, RuntimeConsoleTab, RuntimeHealthCheck } from "../../state/RuntimeConsoleStore";
import RuntimeConsoleToolbar from "./RuntimeConsoleToolbar";
import RuntimeHealthList from "./RuntimeHealthList";
import RuntimeLogsList, { type RuntimeConsoleLogFilter } from "./RuntimeLogsList";

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
  readonly onRestartRuntime?: () => void;
  readonly canRestartRuntime?: boolean;
  readonly isRestartingRuntime?: boolean;
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
  onRestartRuntime,
  canRestartRuntime = false,
  isRestartingRuntime = false,
}: RuntimeConsoleDrawerProps): JSX.Element {
  const logCount = Math.max(logs.length, events.length);
  const [activeLogFilter, setActiveLogFilter] = useState<RuntimeConsoleLogFilter>("all");

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
          <RuntimeLogsList
            logs={logs}
            activeFilter={activeLogFilter}
            onFilterChange={setActiveLogFilter}
            onClearLogs={onClearLogs}
            onRefreshHealth={onRefreshHealth}
            onRestartRuntime={onRestartRuntime}
            canRestartRuntime={canRestartRuntime}
            isRestartingRuntime={isRestartingRuntime}
          />
        )
      ) : null}
    </section>
  );
}
