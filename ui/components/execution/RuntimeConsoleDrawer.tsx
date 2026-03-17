import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import RuntimeConsoleToolbar from "./RuntimeConsoleToolbar";
import RuntimeEventList from "./RuntimeEventList";

export interface RuntimeConsoleDrawerProps {
  readonly isExpanded: boolean;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly onToggleExpanded: () => void;
  readonly onClearEvents: () => void;
}

export default function RuntimeConsoleDrawer({
  isExpanded,
  events,
  onToggleExpanded,
  onClearEvents,
}: RuntimeConsoleDrawerProps): JSX.Element {
  return (
    <section className={`ui-runtime-console${isExpanded ? " ui-runtime-console--expanded" : ""}`}>
      <RuntimeConsoleToolbar
        isExpanded={isExpanded}
        eventCount={events.length}
        onToggle={onToggleExpanded}
        onClear={onClearEvents}
      />
      {isExpanded ? <RuntimeEventList events={events} /> : null}
    </section>
  );
}
