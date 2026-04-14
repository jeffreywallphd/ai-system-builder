import {
  type ContractError,
  type ContractErrorCode,
  type ContractErrorDetails,
  createContractError,
} from "../shared";
import type { RuntimeExecutionDiagnostic } from "./runtime-execution-diagnostic";
import type { RuntimeTarget } from "./runtime-target";

export type RuntimeExecutionFailurePhase =
  | "target-resolution"
  | "validation"
  | "dispatch"
  | "execution"
  | "result-mapping"
  | "unknown";

export type RuntimeExecutionFailureDetails = ContractErrorDetails & {
  phase?: RuntimeExecutionFailurePhase;
  retryable?: boolean;
  targetKind?: string;
  diagnostic?: RuntimeExecutionDiagnostic;
};

export interface RuntimeExecutionError<
  TDetails extends RuntimeExecutionFailureDetails = RuntimeExecutionFailureDetails,
> extends ContractError<TDetails> {
  operation: string;
  executionId: string;
  target: RuntimeTarget;
}

export function createRuntimeExecutionError<
  TDetails extends RuntimeExecutionFailureDetails = RuntimeExecutionFailureDetails,
>(
  operation: string,
  executionId: string,
  target: RuntimeTarget,
  code: ContractErrorCode,
  message: string,
  options?: {
    details?: TDetails;
    requestId?: string;
    correlationId?: string;
  },
): RuntimeExecutionError<TDetails> {
  const contractError = createContractError(code, message, {
    details: options?.details,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  });

  return {
    ...contractError,
    operation,
    executionId,
    target,
  };
}
