import type { IExecutionEngineEvent, IExecutionRunSnapshot } from "./ExecutionContracts";
import type { IExecutionPlanResult } from "./UnifiedExecutionEngine";

export interface IExecutionRunHandle {
  readonly runId: string;
  readonly planId: string;
  getSnapshot(): Promise<IExecutionRunSnapshot>;
  waitForCompletion(): Promise<IExecutionPlanResult>;
  cancel(): Promise<void>;
  subscribe?(
    listener: (event: IExecutionEngineEvent) => void
  ): Promise<() => void> | (() => void);
}

export class ExecutionRunHandle implements IExecutionRunHandle {
  public readonly runId: string;
  public readonly planId: string;

  private currentSnapshot: IExecutionRunSnapshot;
  private readonly completionPromise: Promise<IExecutionPlanResult>;
  private readonly cancelFn: () => Promise<void>;
  private readonly subscribeFn?: (
    listener: (event: IExecutionEngineEvent) => void
  ) => Promise<() => void> | (() => void);

  constructor(params: {
    runId: string;
    planId: string;
    initialSnapshot: IExecutionRunSnapshot;
    completionPromise: Promise<IExecutionPlanResult>;
    cancel: () => Promise<void>;
    subscribe?: (
      listener: (event: IExecutionEngineEvent) => void
    ) => Promise<() => void> | (() => void);
  }) {
    this.runId = params.runId;
    this.planId = params.planId;
    this.currentSnapshot = params.initialSnapshot;
    this.cancelFn = params.cancel;
    this.subscribeFn = params.subscribe;
    this.completionPromise = params.completionPromise.then((result) => {
      this.currentSnapshot = result.run;
      return result;
    });
  }

  public async getSnapshot(): Promise<IExecutionRunSnapshot> {
    return this.currentSnapshot;
  }

  public async waitForCompletion(): Promise<IExecutionPlanResult> {
    return this.completionPromise;
  }

  public async cancel(): Promise<void> {
    await this.cancelFn();
  }

  public updateSnapshot(snapshot: IExecutionRunSnapshot): void {
    this.currentSnapshot = snapshot;
  }

  public subscribe?(
    listener: (event: IExecutionEngineEvent) => void,
  ): Promise<() => void> | (() => void) {
    if (!this.subscribeFn) {
      return () => undefined;
    }

    return this.subscribeFn(listener);
  }
}
