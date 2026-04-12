import type { RunSubmissionSource } from "@domain/runs/RunDomain";
import type {
  RunSubmissionResourceReference,
  RunSubmissionSecurityPrerequisite,
  RunSubmissionStorageReference,
} from "@application/runs/ports/RunSubmissionValidationPorts";

export const RunExecutionBackendKinds = Object.freeze({
  localWorker: "local-worker",
  remoteDispatch: "remote-dispatch",
  comfyUi: "comfyui",
});

export type RunExecutionBackendKind =
  typeof RunExecutionBackendKinds[keyof typeof RunExecutionBackendKinds];

export interface CanonicalRunExecutionCommand {
  readonly commandId: string;
  readonly dispatchAttemptId: string;
  readonly preparedAt: string;
  readonly run: {
    readonly runId: string;
    readonly workflowId: string;
    readonly workspaceId?: string;
    readonly submittedAt: string;
    readonly source: RunSubmissionSource;
    readonly submittedByActorId?: string;
    readonly correlationId?: string;
  };
  readonly queue: {
    readonly queueId: string;
  };
  readonly assignment: {
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
  };
  readonly runtimeTarget: {
    readonly systemId: string;
    readonly versionId: string;
    readonly executionId?: string;
    readonly tenantId?: string;
    readonly async: boolean;
  };
  readonly backend: {
    readonly kind: RunExecutionBackendKind;
  };
  readonly inputs: {
    readonly tags: ReadonlyArray<string>;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
  readonly references: {
    readonly storageReferences: ReadonlyArray<RunSubmissionStorageReference>;
    readonly resourceReferences: ReadonlyArray<RunSubmissionResourceReference>;
    readonly policyPrerequisites: ReadonlyArray<RunSubmissionSecurityPrerequisite>;
  };
}

export interface RunExecutionDispatchReceipt {
  readonly dispatchId: string;
  readonly backendKind: RunExecutionBackendKind;
  readonly acceptedAt: string;
  readonly status: "accepted";
  readonly backendRunId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IRunExecutionDispatchPort {
  dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt>;
}

export interface IRunExecutionBackendAdapter {
  readonly backendKind: RunExecutionBackendKind;
  dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt>;
}

