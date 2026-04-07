import type { RuntimeExecutionResultReadModel } from "../../../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import { ExecutionDiagnosticsPanel } from "./ExecutionDiagnosticsPanel";
import { ExecutionNodeResultList } from "./ExecutionNodeResultList";
import { ExecutionOutputSummary } from "./ExecutionOutputSummary";

export function ExecutionResultPanel({ result }: { readonly result?: RuntimeExecutionResultReadModel }): JSX.Element {
  if (!result) {
    return (
      <div className="ui-stack ui-stack--xs" data-testid="execution-result-panel">
        <strong>Execution results</strong>
        <p className="ui-text-small ui-text-secondary">Execution output/result data appears here after a run is available.</p>
      </div>
    );
  }

  return (
    <div className="ui-stack ui-stack--sm" data-testid="execution-result-panel">
      <ExecutionOutputSummary result={result} />
      <ExecutionNodeResultList result={result} />
      <ExecutionDiagnosticsPanel result={result} />
    </div>
  );
}
