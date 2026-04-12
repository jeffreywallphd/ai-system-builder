import type { RuntimeEvent } from "@application/runtime/RuntimeEvent";
import RuntimeEventRow from "./RuntimeEventRow";

export interface RuntimeEventListProps {
  readonly events: ReadonlyArray<RuntimeEvent>;
}

export default function RuntimeEventList({ events }: RuntimeEventListProps): JSX.Element {
  if (events.length === 0) {
    return <div className="ui-runtime-console__empty">Runtime events will appear here.</div>;
  }

  return (
    <ul className="ui-runtime-console__list ui-scrollbar">
      {events.map((event) => (
        <RuntimeEventRow key={event.id} event={event} />
      ))}
    </ul>
  );
}

