import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
  type IRunExecutionBackendAdapter,
  type RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";

export interface ComfyUiDispatchPayload {
  readonly runId: string;
  readonly queueId: string;
  readonly nodeId: string;
  readonly comfyTarget: {
    readonly systemId: string;
    readonly versionId: string;
  };
  readonly workflowId: string;
  readonly inputParameters: Readonly<Record<string, unknown>>;
  readonly assetReferences: {
    readonly storageReferences: CanonicalRunExecutionCommand["references"]["storageReferences"];
    readonly resourceReferences: CanonicalRunExecutionCommand["references"]["resourceReferences"];
  };
}

export interface ComfyUiDispatchGateway {
  submitComfyUiDispatch(payload: ComfyUiDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

interface ComfyUiRunExecutionDispatchAdapterDependencies {
  readonly gateway: ComfyUiDispatchGateway;
  readonly now?: () => Date;
}

export class ComfyUiRunExecutionDispatchAdapter implements IRunExecutionBackendAdapter {
  public readonly backendKind = RunExecutionBackendKinds.comfyUi;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: ComfyUiRunExecutionDispatchAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt> {
    const payload: ComfyUiDispatchPayload = Object.freeze({
      runId: command.run.runId,
      queueId: command.queue.queueId,
      nodeId: command.assignment.nodeId,
      comfyTarget: Object.freeze({
        systemId: command.runtimeTarget.systemId,
        versionId: command.runtimeTarget.versionId,
      }),
      workflowId: command.run.workflowId,
      inputParameters: command.inputs.parameters,
      assetReferences: Object.freeze({
        storageReferences: command.references.storageReferences,
        resourceReferences: command.references.resourceReferences,
      }),
    });

    const dispatched = await this.dependencies.gateway.submitComfyUiDispatch(payload);
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

