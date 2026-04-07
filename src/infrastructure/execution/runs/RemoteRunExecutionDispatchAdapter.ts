import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
  type IRunExecutionBackendAdapter,
  type RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";

export interface RemoteRunDispatchPayload {
  readonly runRef: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly queueId: string;
    readonly dispatchAttemptId: string;
  };
  readonly assignment: {
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
  };
  readonly runtimeTarget: CanonicalRunExecutionCommand["runtimeTarget"];
  readonly inputs: CanonicalRunExecutionCommand["inputs"];
  readonly references: CanonicalRunExecutionCommand["references"];
}

export interface RemoteRunDispatchGateway {
  submitRemoteDispatch(payload: RemoteRunDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

interface RemoteRunExecutionDispatchAdapterDependencies {
  readonly gateway: RemoteRunDispatchGateway;
  readonly now?: () => Date;
}

export class RemoteRunExecutionDispatchAdapter implements IRunExecutionBackendAdapter {
  public readonly backendKind = RunExecutionBackendKinds.remoteDispatch;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: RemoteRunExecutionDispatchAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt> {
    const payload: RemoteRunDispatchPayload = Object.freeze({
      runRef: Object.freeze({
        runId: command.run.runId,
        workspaceId: command.run.workspaceId,
        queueId: command.queue.queueId,
        dispatchAttemptId: command.dispatchAttemptId,
      }),
      assignment: Object.freeze({
        nodeId: command.assignment.nodeId,
        reservationOwner: command.assignment.reservationOwner,
        claimToken: command.assignment.claimToken,
      }),
      runtimeTarget: command.runtimeTarget,
      inputs: command.inputs,
      references: command.references,
    });

    const dispatched = await this.dependencies.gateway.submitRemoteDispatch(payload);
    return Object.freeze({
      dispatchId: `dispatch:${command.dispatchAttemptId}`,
      backendKind: this.backendKind,
      acceptedAt: dispatched.acceptedAt?.trim() || this.now().toISOString(),
      status: "accepted",
      backendRunId: dispatched.backendRunId,
      metadata: dispatched.metadata,
    });
  }
}

