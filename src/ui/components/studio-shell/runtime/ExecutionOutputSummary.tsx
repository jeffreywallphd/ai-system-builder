import type { RuntimeExecutionResultReadModel } from "../../../../infrastructure/api/system-runtime/SystemRuntimeBackendApi";

export function ExecutionOutputSummary({ result }: { readonly result: RuntimeExecutionResultReadModel }): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-output-summary">
      <strong>Execution output summary</strong>
      <div className="ui-text-small ui-text-secondary">
        Status: {result.status} · Output available: {result.outputSummary.hasOutput ? "yes" : "no"}
      </div>
      <div className="ui-text-small ui-text-secondary">
        Node outputs: {result.outputSummary.outputFieldCount}
      </div>
      <div className="ui-text-small ui-text-secondary">
        Contract outputs: {result.outputSummary.contractOutputIds.length > 0 ? result.outputSummary.contractOutputIds.join(", ") : "none"}
      </div>
      {result.output?.error ? (
        <div className="ui-text-small ui-text-danger">
          Output error: {result.output.error.code} — {result.output.error.message}
        </div>
      ) : null}
    </div>
  );
}
