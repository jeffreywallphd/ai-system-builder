import type { RuntimeExecutionResultReadModel } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";

export function ExecutionDiagnosticsPanel({ result }: { readonly result: RuntimeExecutionResultReadModel }): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-diagnostics-panel">
      <strong>Diagnostics/error outputs</strong>
      {result.diagnostics.length === 0 ? (
        <p className="ui-text-small ui-text-secondary">No diagnostics were recorded for this run.</p>
      ) : (
        <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {result.diagnostics.slice(0, 12).map((entry, index) => (
            <li key={`${entry.source}:${entry.message}:${index}`} className="ui-text-small">
              <strong>{entry.severity}</strong> Â· {entry.source}
              {entry.code ? ` (${entry.code})` : ""}
              : {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

