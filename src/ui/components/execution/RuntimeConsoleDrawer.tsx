import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import { useState } from "react";
import type {
  RuntimeConsoleLogEntry,
  RuntimeConsoleTab,
  RuntimeHealthCheck,
} from "../../state/RuntimeConsoleStore";
import type { RuntimeLogVerbosity } from "../../../application/runtime/RuntimeDiagnostics";
import RuntimeConsoleToolbar from "./RuntimeConsoleToolbar";
import RuntimeHealthList from "./RuntimeHealthList";
import RuntimeLogsList, { type RuntimeConsoleLogFilter } from "./RuntimeLogsList";

export interface RuntimeConsoleDrawerProps {
  readonly isExpanded: boolean;
  readonly activeTab: RuntimeConsoleTab;
  readonly logVerbosity: RuntimeLogVerbosity;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshingHealth?: boolean;
  readonly onToggleExpanded: () => void;
  readonly onClearLogs: () => void;
  readonly onRefreshHealth: () => void;
  readonly onSelectTab: (tab: RuntimeConsoleTab) => void;
  readonly onLogVerbosityChange: (verbosity: RuntimeLogVerbosity) => void;
  readonly onRestartRuntime?: () => void;
  readonly canRestartRuntime?: boolean;
  readonly isRestartingRuntime?: boolean;
}

export default function RuntimeConsoleDrawer({
  isExpanded,
  activeTab,
  logVerbosity,
  events,
  logs,
  healthChecks,
  isRefreshingHealth = false,
  onToggleExpanded,
  onClearLogs,
  onRefreshHealth,
  onSelectTab,
  onLogVerbosityChange,
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
            logVerbosity={logVerbosity}
            onFilterChange={setActiveLogFilter}
            onLogVerbosityChange={onLogVerbosityChange}
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
