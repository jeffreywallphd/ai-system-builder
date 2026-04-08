import type { IRunExecutionCancellationSignalPort } from "@application/runs/ports/RunExecutionCancellationPorts";
import type {
  IRunExecutionBackendAdapter,
  IRunExecutionDispatchPort,
  RunExecutionBackendKind,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import type { IImageManipulationExecutionCapabilityPort } from "@application/image-workflows/ports";
import { RunExecutionDispatchRouter } from "./RunExecutionDispatchRouter";
import { ComfyUiRunExecutionCancellationSignalAdapter } from "./ComfyUiRunExecutionCancellationSignalAdapter";
import type { ComfyUiExecutionAdapterInfrastructure } from "../comfyui/ComfyUiExecutionAdapterComposition";

export interface AuthoritativeRunExecutionAdapterRegistration {
  readonly dispatchPort?: IRunExecutionDispatchPort;
  readonly dispatchAdapters: ReadonlyArray<IRunExecutionBackendAdapter>;
  readonly cancellationSignalPort?: IRunExecutionCancellationSignalPort;
  readonly capabilityProbePort?: IImageManipulationExecutionCapabilityPort;
  readonly registeredBackendKinds: ReadonlyArray<RunExecutionBackendKind>;
}

export interface CreateAuthoritativeRunExecutionAdapterRegistrationOptions {
  readonly comfyUiExecutionAdapter?: ComfyUiExecutionAdapterInfrastructure;
}

export function createAuthoritativeRunExecutionAdapterRegistration(
  input: CreateAuthoritativeRunExecutionAdapterRegistrationOptions,
): AuthoritativeRunExecutionAdapterRegistration | undefined {
  const dispatchAdapters: IRunExecutionBackendAdapter[] = [];
  let cancellationSignalPort: IRunExecutionCancellationSignalPort | undefined;
  let capabilityProbePort: IImageManipulationExecutionCapabilityPort | undefined;

  if (input.comfyUiExecutionAdapter) {
    dispatchAdapters.push(input.comfyUiExecutionAdapter.runDispatchAdapter);
    cancellationSignalPort = new ComfyUiRunExecutionCancellationSignalAdapter({
      cancellationPort: input.comfyUiExecutionAdapter.cancellationAdapter,
    });
    capabilityProbePort = input.comfyUiExecutionAdapter.capabilityProbeAdapter;
  }

  if (dispatchAdapters.length < 1 && !cancellationSignalPort && !capabilityProbePort) {
    return undefined;
  }

  const dispatchPort = dispatchAdapters.length > 0
    ? new RunExecutionDispatchRouter(dispatchAdapters)
    : undefined;
  const registeredBackendKinds = Object.freeze(
    dispatchAdapters.map((adapter) => adapter.backendKind),
  );

  return Object.freeze({
    dispatchPort,
    dispatchAdapters: Object.freeze([...dispatchAdapters]),
    cancellationSignalPort,
    capabilityProbePort,
    registeredBackendKinds,
  });
}
