import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
  type IRunExecutionBackendAdapter,
  type RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import { normalizeRunExecutionDispatchAdapterError } from "./RunExecutionDispatchFailure";

export interface LocalWorkerDispatchPayload {
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId?: string;
  readonly nodeId: string;
  readonly dispatchAttemptId: string;
  readonly runtime: {
    readonly systemId: string;
    readonly versionId: string;
  };
  readonly inputs: {
    readonly tags: ReadonlyArray<string>;
    readonly parameters: Readonly<Record<string, unknown>>;
  };
  readonly references: {
    readonly storageReferences: CanonicalRunExecutionCommand["references"]["storageReferences"];
    readonly resourceReferences: CanonicalRunExecutionCommand["references"]["resourceReferences"];
    readonly policyPrerequisites: CanonicalRunExecutionCommand["references"]["policyPrerequisites"];
  };
}

export interface LocalWorkerDispatchGateway {
  submitLocalWorkerDispatch(payload: LocalWorkerDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

interface LocalWorkerRunExecutionDispatchAdapterDependencies {
  readonly gateway: LocalWorkerDispatchGateway;
  readonly now?: () => Date;
}

export class LocalWorkerRunExecutionDispatchAdapter implements IRunExecutionBackendAdapter {
  public readonly backendKind = RunExecutionBackendKinds.localWorker;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: LocalWorkerRunExecutionDispatchAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt> {
    const payload: LocalWorkerDispatchPayload = Object.freeze({
      runId: command.run.runId,
      workflowId: command.run.workflowId,
      workspaceId: command.run.workspaceId,
      nodeId: command.assignment.nodeId,
      dispatchAttemptId: command.dispatchAttemptId,
      runtime: Object.freeze({
        systemId: command.runtimeTarget.systemId,
        versionId: command.runtimeTarget.versionId,
      }),
      inputs: Object.freeze({
        tags: command.inputs.tags,
        parameters: command.inputs.parameters,
      }),
      references: Object.freeze({
        storageReferences: command.references.storageReferences,
        resourceReferences: command.references.resourceReferences,
        policyPrerequisites: command.references.policyPrerequisites,
      }),
    });

    try {
      const dispatched = await this.dependencies.gateway.submitLocalWorkerDispatch(payload);
      return Object.freeze({
        dispatchId: `dispatch:${command.dispatchAttemptId}`,
        backendKind: this.backendKind,
        acceptedAt: dispatched.acceptedAt?.trim() || this.now().toISOString(),
        status: "accepted",
        backendRunId: dispatched.backendRunId,
        metadata: dispatched.metadata,
      });
    } catch (error) {
      throw normalizeRunExecutionDispatchAdapterError(error);
    }
  }
}

