import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import type { CanonicalRunExecutionCommand, RunExecutionDispatchReceipt } from "@application/runs/ports/RunExecutionDispatchPorts";

export interface RunDispatchFailureReason {
  readonly safeCode: string;
  readonly safeMessage: string;
  readonly internalCode?: string;
  readonly internalMessage?: string;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type RunDispatchOutcome =
  | {
    readonly status: "accepted";
    readonly receipt: RunExecutionDispatchReceipt;
  }
  | {
    readonly status: "failed-to-start";
    readonly failedAt: string;
    readonly failure: RunDispatchFailureReason;
  };

export function transitionRunToDispatching(input: {
  readonly run: CanonicalRunRecord;
  readonly occurredAt: string;
  readonly command: CanonicalRunExecutionCommand;
}): CanonicalRunRecord {
  if (input.run.state === RunLifecycleStates.dispatching) {
    return input.run;
  }

  return transitionCanonicalRunRecord(input.run, {
    toState: RunLifecycleStates.dispatching,
    occurredAt: input.occurredAt,
    execution: Object.freeze({
      ...input.run.execution,
      adapterKind: input.command.backend.kind,
      outcome: RunExecutionOutcomeKinds.none,
    }),
  });
}

export function transitionDispatchingRunToOutcome(input: {
  readonly run: CanonicalRunRecord;
  readonly command: CanonicalRunExecutionCommand;
  readonly outcome: RunDispatchOutcome;
}): CanonicalRunRecord {
  if (input.outcome.status === "accepted") {
    return transitionCanonicalRunRecord(input.run, {
      toState: RunLifecycleStates.running,
      occurredAt: input.outcome.receipt.acceptedAt,
      execution: Object.freeze({
        ...input.run.execution,
        adapterKind: input.command.backend.kind,
        adapterRunId: input.outcome.receipt.backendRunId ?? input.outcome.receipt.dispatchId,
        startedAt: input.outcome.receipt.acceptedAt,
        outcome: RunExecutionOutcomeKinds.none,
        errorCode: undefined,
        errorMessage: undefined,
      }),
    });
  }

  return transitionCanonicalRunRecord(input.run, {
    toState: RunLifecycleStates.failed,
    occurredAt: input.outcome.failedAt,
    execution: Object.freeze({
      ...input.run.execution,
      adapterKind: input.command.backend.kind,
      adapterRunId: undefined,
      finishedAt: input.outcome.failedAt,
      outcome: RunExecutionOutcomeKinds.failed,
      errorCode: input.outcome.failure.safeCode,
      errorMessage: input.outcome.failure.safeMessage,
    }),
  });
}
