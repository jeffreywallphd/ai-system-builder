import type { RuntimeEvent } from "@application/runtime/RuntimeEvent";

export interface RuntimeEventRowProps {
  readonly event: RuntimeEvent;
}

export default function RuntimeEventRow({ event }: RuntimeEventRowProps): JSX.Element {
  return (
    <li className={`ui-runtime-console__event ui-runtime-console__event--${event.severity}`}>
      <span className="ui-runtime-console__timestamp">{new Date(event.timestamp).toLocaleTimeString()}</span>
      <span className="ui-runtime-console__source">{event.source}</span>
      <span className="ui-runtime-console__severity">{event.severity}</span>
      <span className="ui-runtime-console__message">{event.message}</span>
    </li>
  );
}

