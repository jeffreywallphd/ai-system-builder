import type { RuntimeExecutionResultReadModel } from "../../../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";

export function ExecutionNodeResultList({ result }: { readonly result: RuntimeExecutionResultReadModel }): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-node-result-list">
      <strong>Step/node output summaries</strong>
      {result.nodeResults.length === 0 ? (
        <p className="ui-text-small ui-text-secondary">No node results are available for this run.</p>
      ) : (
        <div className="ui-stack ui-stack--2xs">
          {result.nodeResults.map((node) => (
            <div key={node.nodeId} className="ui-panel ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                <strong className="ui-text-small">{node.nodeId}</strong>
                <span className="ui-text-small ui-text-secondary">{node.status}</span>
              </div>
              <span className="ui-text-small ui-text-secondary">{node.structuralKind}/{node.semanticRole}</span>
              <span className="ui-text-small ui-text-secondary">{node.outputSummary ?? "No output summary."}</span>
            </div>
          ))}
        </div>
      )}
      <details>
        <summary>Nested system result summaries ({result.nestedSystemResults.length})</summary>
        {result.nestedSystemResults.length === 0 ? (
          <p className="ui-text-small ui-text-secondary">No nested system results were captured.</p>
        ) : (
          <ul className="ui-text-small ui-text-secondary" style={{ marginTop: "0.5rem" }}>
            {result.nestedSystemResults.map((nested) => (
              <li key={nested.nodeId}>{nested.nodeId}: {nested.status}{nested.outputSummary ? ` — ${nested.outputSummary}` : ""}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
