import type {
  CanonicalRunExecutionCommand,
  IRunExecutionBackendAdapter,
  IRunExecutionDispatchPort,
  RunExecutionBackendKind,
  RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";

export class RunExecutionDispatchRouter implements IRunExecutionDispatchPort {
  private readonly adaptersByKind: ReadonlyMap<RunExecutionBackendKind, IRunExecutionBackendAdapter>;

  public constructor(adapters: ReadonlyArray<IRunExecutionBackendAdapter>) {
    const byKind = new Map<RunExecutionBackendKind, IRunExecutionBackendAdapter>();
    for (const adapter of adapters) {
      if (byKind.has(adapter.backendKind)) {
        throw new Error(`Run execution adapter '${adapter.backendKind}' is registered more than once.`);
      }
      byKind.set(adapter.backendKind, adapter);
    }
    this.adaptersByKind = byKind;
  }

  public async dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt> {
    const adapter = this.adaptersByKind.get(command.backend.kind);
    if (!adapter) {
      throw new Error(`No run execution dispatch adapter is registered for backend '${command.backend.kind}'.`);
    }
    return adapter.dispatch(command);
  }
}

