import type {
  CanonicalRunExecutionCommand,
  IRunExecutionDispatchPort,
  RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunLifecycleStates, transitionCanonicalRunRecord } from "@domain/runs/RunDomain";
import {
  createDispatchAcceptedOutcome,
  createDispatchFailureOutcome,
  type HandleRunDispatchResultRequest,
} from "./HandleRunDispatchResultUseCase";
import {
  mapPlatformRunRecordToCanonicalRun,
  updatePlatformRunRecordCanonicalState,
} from "./RunCreationPersistenceMapper";
import type {
  BuildAssignedRunExecutionCommandRequest,
} from "./BuildAssignedRunExecutionCommandUseCase";

interface DispatchAssignedRunExecutionCommandBuilderPort {
  execute(request: BuildAssignedRunExecutionCommandRequest): Promise<CanonicalRunExecutionCommand>;
}

interface DispatchAssignedRunExecutionUseCaseDependencies {
  readonly commandBuilder: DispatchAssignedRunExecutionCommandBuilderPort;
  readonly dispatchPort: IRunExecutionDispatchPort;
  readonly dispatchResultHandler: {
    execute(request: HandleRunDispatchResultRequest): Promise<unknown>;
  };
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
}

export interface DispatchAssignedRunExecutionRequest extends BuildAssignedRunExecutionCommandRequest {}

export interface DispatchAssignedRunExecutionResult {
  readonly command: CanonicalRunExecutionCommand;
  readonly receipt: RunExecutionDispatchReceipt;
}

export const RunDispatchGuardErrorCodes = Object.freeze({
  runNotFound: "run-not-found",
  dispatchAttemptNotFound: "dispatch-attempt-not-found",
  dispatchAttemptNodeMismatch: "dispatch-attempt-node-mismatch",
  dispatchAttemptAlreadyFinalized: "dispatch-attempt-already-finalized",
  duplicateDispatchDetected: "duplicate-dispatch-detected",
} as const);

export type RunDispatchGuardErrorCode = typeof RunDispatchGuardErrorCodes[keyof typeof RunDispatchGuardErrorCodes];

export class RunDispatchGuardError extends Error {
  public readonly code: RunDispatchGuardErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: RunDispatchGuardErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "RunDispatchGuardError";
    this.code = code;
    this.details = details;
  }
}

export class DispatchAssignedRunExecutionUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: DispatchAssignedRunExecutionUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(request: DispatchAssignedRunExecutionRequest): Promise<DispatchAssignedRunExecutionResult> {
    const command = await this.dependencies.commandBuilder.execute(request);
    const dispatchStartedAt = this.now().toISOString();
    await this.assertDispatchEligibilityAndMarkDispatching({
      command,
      dispatchStartedAt,
    });

    let receipt: RunExecutionDispatchReceipt;
    try {
      receipt = await this.dependencies.dispatchPort.dispatch(command);
    } catch (error) {
      await this.dependencies.dispatchResultHandler.execute({
        command,
        dispatchStartedAt,
        outcome: createDispatchFailureOutcome({
          failedAt: this.now().toISOString(),
          error,
        }),
      });
      throw error;
    }

    await this.dependencies.dispatchResultHandler.execute({
      command,
      dispatchStartedAt,
      outcome: createDispatchAcceptedOutcome(receipt),
    });

    return Object.freeze({
      command,
      receipt,
    });
  }

  private async assertDispatchEligibilityAndMarkDispatching(input: {
    readonly command: CanonicalRunExecutionCommand;
    readonly dispatchStartedAt: string;
  }): Promise<void> {
    const runId = input.command.run.runId;
    let guardError: RunDispatchGuardError | undefined;

    try {
      await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
        const persistedRun = await this.dependencies.runRepository.findRunById(runId);
        if (!persistedRun) {
          throw new RunDispatchGuardError(
            RunDispatchGuardErrorCodes.runNotFound,
            `Run '${runId}' was not found.`,
          );
        }

        const dispatchAttempts = await this.dependencies.queueRepository.listDispatchAttemptsByRunId(runId);
        const dispatchAttempt = dispatchAttempts.find(
          (entry) => entry.attemptId === input.command.dispatchAttemptId,
        );
        if (!dispatchAttempt) {
          throw new RunDispatchGuardError(
            RunDispatchGuardErrorCodes.dispatchAttemptNotFound,
            `Run '${runId}' dispatch attempt '${input.command.dispatchAttemptId}' was not found.`,
          );
        }
        if (dispatchAttempt.nodeId !== input.command.assignment.nodeId) {
          throw new RunDispatchGuardError(
            RunDispatchGuardErrorCodes.dispatchAttemptNodeMismatch,
            `Run '${runId}' dispatch attempt node does not match command assignment node.`,
            Object.freeze({
              dispatchAttemptNodeId: dispatchAttempt.nodeId,
              commandAssignmentNodeId: input.command.assignment.nodeId,
            }),
          );
        }
        if (dispatchAttempt.dispatchResult) {
          throw new RunDispatchGuardError(
            RunDispatchGuardErrorCodes.dispatchAttemptAlreadyFinalized,
            `Run '${runId}' dispatch attempt '${dispatchAttempt.attemptId}' is already finalized.`,
            Object.freeze({
              resultStatus: dispatchAttempt.dispatchResult.status,
              recordedAt: dispatchAttempt.dispatchResult.recordedAt,
            }),
          );
        }

        const canonicalRun = mapPlatformRunRecordToCanonicalRun(persistedRun);
        if (canonicalRun.state !== RunLifecycleStates.assigned) {
          throw new RunDispatchGuardError(
            RunDispatchGuardErrorCodes.duplicateDispatchDetected,
            `Run '${runId}' is not dispatch-eligible from state '${canonicalRun.state}'.`,
            Object.freeze({
              state: canonicalRun.state,
            }),
          );
        }

        const dispatchingRun = transitionCanonicalRunRecord(canonicalRun, {
          toState: RunLifecycleStates.dispatching,
          occurredAt: input.dispatchStartedAt,
          execution: Object.freeze({
            ...canonicalRun.execution,
            adapterKind: input.command.backend.kind,
          }),
        });
        const dispatchingRecord = updatePlatformRunRecordCanonicalState(persistedRun, dispatchingRun);

        await this.dependencies.runRepository.saveRun({
          ...dispatchingRecord,
          runId: persistedRun.runId,
          revision: persistedRun.revision,
        }, {
          operationKey: `run:dispatch-guard:${runId}:${input.command.dispatchAttemptId}`,
          actorId: input.command.assignment.reservationOwner,
          occurredAt: input.dispatchStartedAt,
          correlationId: input.command.run.correlationId,
          expectedRevision: persistedRun.revision,
        });
      });
    } catch (error) {
      if (error instanceof RunDispatchGuardError) {
        guardError = error;
      } else if (isOptimisticConcurrencyConflict(error)) {
        guardError = new RunDispatchGuardError(
          RunDispatchGuardErrorCodes.duplicateDispatchDetected,
          `Run '${runId}' dispatch guard detected concurrent dispatch mutation.`,
        );
      } else {
        throw error;
      }
    }

    if (guardError) {
      throw guardError;
    }
  }
}

function isOptimisticConcurrencyConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.toLowerCase().includes("expectedrevision mismatch");
}

