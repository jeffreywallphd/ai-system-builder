import type {
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
} from "../../../../infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import { ExecutionStatusSummary } from "./ExecutionStatusSummary";
import { ExecutionStepStatusList } from "./ExecutionStepStatusList";
import { ExecutionTracePanel } from "./ExecutionTracePanel";

export function ExecutionMonitorPanel(input: {
  readonly status?: RuntimeExecutionStatusReadModel;
  readonly trace?: RuntimeExecutionTraceReadModel;
}): JSX.Element {
  if (!input.status) {
    return (
      <div className="ui-stack ui-stack--xs" data-testid="execution-monitor-panel">
        <strong>Execution monitoring</strong>
        <p className="ui-text-small ui-text-secondary">Start a system run to view runtime progression and trace details.</p>
      </div>
    );
  }

  return (
    <div className="ui-stack ui-stack--sm" data-testid="execution-monitor-panel">
      <ExecutionStatusSummary status={input.status} />
      <ExecutionStepStatusList status={input.status} />
      <ExecutionTracePanel trace={input.trace} />
    </div>
  );
}
