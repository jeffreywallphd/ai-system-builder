import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import type { RuntimeHealthCheck } from "../../state/RuntimeConsoleStore";
import RuntimeConsoleToolbar from "./RuntimeConsoleToolbar";
import RuntimeEventList from "./RuntimeEventList";
import RuntimeHealthList from "./RuntimeHealthList";

export interface RuntimeConsoleDrawerProps {
  readonly isExpanded: boolean;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshingHealth?: boolean;
  readonly onToggleExpanded: () => void;
  readonly onClearEvents: () => void;
  readonly onRefreshHealth: () => void;
}

export default function RuntimeConsoleDrawer({
  isExpanded,
  events,
  healthChecks,
  isRefreshingHealth = false,
  onToggleExpanded,
  onClearEvents,
  onRefreshHealth,
}: RuntimeConsoleDrawerProps): JSX.Element {
  return (
    <section className={`ui-runtime-console${isExpanded ? " ui-runtime-console--expanded" : ""}`}>
      <RuntimeConsoleToolbar
        isExpanded={isExpanded}
        eventCount={events.length}
        onToggle={onToggleExpanded}
        onClear={onClearEvents}
      />
      {isExpanded ? (
        <>
          <RuntimeHealthList
            healthChecks={healthChecks}
            isRefreshing={isRefreshingHealth}
            onRefresh={onRefreshHealth}
          />
          <RuntimeEventList events={events} />
        </>
      ) : null}
    </section>
  );
}
