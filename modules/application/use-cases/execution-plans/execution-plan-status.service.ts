import type { ExecutionPlanStatus } from "../../../contracts/execution-plans";
import type { RuntimeReadinessStatus } from "../../../contracts/runtime-readiness";

export class ExecutionPlanStatusService {
  public calculate(args: { readinessStatus: RuntimeReadinessStatus; hasStaleSource: boolean; hasBlockers: boolean; hasMissingInputs: boolean; hasMissingOutputs: boolean; hasMissingAdapters: boolean; }): ExecutionPlanStatus {
    if (args.readinessStatus !== "ready-for-setup") return "needs-setup";
    if (args.hasStaleSource) return "stale";
    if (args.hasBlockers) return "blocked";
    if (args.hasMissingInputs) return "missing-inputs";
    if (args.hasMissingOutputs) return "missing-outputs";
    if (args.hasMissingAdapters) return "provider-setup-required";
    return "ready-for-review";
  }
}
