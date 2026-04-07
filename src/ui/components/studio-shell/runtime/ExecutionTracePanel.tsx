import type { RuntimeExecutionTraceReadModel } from "../../../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";

export function ExecutionTracePanel({ trace }: { readonly trace: RuntimeExecutionTraceReadModel | undefined }): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-trace-panel">
      <strong>Bounded trace/log entries</strong>
      {!trace ? (
        <p className="ui-text-small ui-text-secondary">Trace data is unavailable for this execution.</p>
      ) : (
        <>
          <div className="ui-text-small ui-text-secondary">
            Events: {trace.trace.events.length} · Logs: {trace.trace.logs.length}
          </div>
          <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
            {trace.trace.events.slice(-8).map((event) => (
              <li key={event.eventId} className="ui-text-small">
                <strong>{event.kind}</strong>
                {event.nodeId ? ` (${event.nodeId})` : ""}
                {event.summary ? ` — ${event.summary}` : ""}
              </li>
            ))}
          </ul>
          {trace.trace.logs.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
              {trace.trace.logs.slice(-6).map((entry) => (
                <li key={entry.entryId} className="ui-text-small">
                  [{entry.level}] {entry.message}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
