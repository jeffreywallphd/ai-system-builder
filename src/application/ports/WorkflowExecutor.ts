import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionProgress,
  IWorkflowExecutionProvenance,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
  INodeExecutionProvenance,
} from "./interfaces/IWorkflowExecutor";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function freezeAssets(assets?: ReadonlyArray<IAsset>): ReadonlyArray<IAsset> {
  return Object.freeze([...(assets ?? [])]);
}

function freezeMessages(messages?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  return messages ? Object.freeze([...messages]) : undefined;
}

function freezeNodeProvenanceMap(nodeProvenance?: Readonly<Record<string, INodeExecutionProvenance>>) {
  if (!nodeProvenance) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(nodeProvenance).map(([key, value]) => [key, Object.freeze({ ...value })])
  ));
}

function freezeProvenance(provenance?: IWorkflowExecutionProvenance): IWorkflowExecutionProvenance | undefined {
  if (!provenance) {
    return undefined;
  }

  return Object.freeze({
    ...provenance,
    fallback: provenance.fallback ? Object.freeze({ ...provenance.fallback }) : undefined,
    nodeCounts: provenance.nodeCounts ? Object.freeze({ ...provenance.nodeCounts }) : undefined,
    mcp: provenance.mcp ? Object.freeze({ ...provenance.mcp }) : undefined,
    nodeProvenance: freezeNodeProvenanceMap(provenance.nodeProvenance),
  });
}

export class WorkflowExecutionProgress implements IWorkflowExecutionProgress {
  public readonly executionId: string;
  public readonly status: IWorkflowExecutionProgress["status"];
  public readonly percent?: number;
  public readonly currentNodeId?: string;
  public readonly message?: string;

  constructor(params: {
    executionId: string;
    status: IWorkflowExecutionProgress["status"];
    percent?: number;
    currentNodeId?: string;
    message?: string;
  }) {
    const executionId = params.executionId.trim();

    if (!executionId) {
      throw new Error("WorkflowExecutionProgress.executionId cannot be empty.");
    }

    this.executionId = executionId;
    this.status = params.status;
    this.percent =
      params.percent !== undefined
        ? Math.max(0, Math.min(100, params.percent))
        : undefined;
    this.currentNodeId = params.currentNodeId?.trim() || undefined;
    this.message = params.message?.trim() || undefined;
  }

  public static from(
    progress: IWorkflowExecutionProgress
  ): WorkflowExecutionProgress {
    return new WorkflowExecutionProgress({
      executionId: progress.executionId,
      status: progress.status,
      percent: progress.percent,
      currentNodeId: progress.currentNodeId,
      message: progress.message,
    });
  }
}

export class WorkflowExecutionEvent implements IWorkflowExecutionEvent {
  public readonly executionId: string;
  public readonly kind: IWorkflowExecutionEvent["kind"];
  public readonly status: IWorkflowExecutionEvent["status"];
  public readonly nodeId?: string;
  public readonly asset?: IAsset;
  public readonly progress?: IWorkflowExecutionProgress;
  public readonly message?: string;
  public readonly payload?: Readonly<Record<string, unknown>>;
  public readonly provenance?: IWorkflowExecutionProvenance;
  public readonly nodeProvenance?: INodeExecutionProvenance;

  constructor(params: {
    executionId: string;
    kind: IWorkflowExecutionEvent["kind"];
    status: IWorkflowExecutionEvent["status"];
    nodeId?: string;
    asset?: IAsset;
    progress?: IWorkflowExecutionProgress;
    message?: string;
    payload?: Readonly<Record<string, unknown>>;
    provenance?: IWorkflowExecutionProvenance;
    nodeProvenance?: INodeExecutionProvenance;
  }) {
    const executionId = params.executionId.trim();

    if (!executionId) {
      throw new Error("WorkflowExecutionEvent.executionId cannot be empty.");
    }

    this.executionId = executionId;
    this.kind = params.kind;
    this.status = params.status;
    this.nodeId = params.nodeId?.trim() || undefined;
    this.asset = params.asset;
    this.progress = params.progress
      ? WorkflowExecutionProgress.from(params.progress)
      : undefined;
    this.message = params.message?.trim() || undefined;
    this.payload = params.payload ? Object.freeze({ ...params.payload }) : undefined;
    this.provenance = freezeProvenance(params.provenance);
    this.nodeProvenance = params.nodeProvenance
      ? Object.freeze({ ...params.nodeProvenance })
      : undefined;
  }

  public static from(event: IWorkflowExecutionEvent): WorkflowExecutionEvent {
    return new WorkflowExecutionEvent({
      executionId: event.executionId,
      kind: event.kind,
      status: event.status,
      nodeId: event.nodeId,
      asset: event.asset,
      progress: event.progress,
      message: event.message,
      payload: event.payload,
      provenance: event.provenance,
      nodeProvenance: event.nodeProvenance,
    });
  }
}

export class WorkflowExecutionResult implements IWorkflowExecutionResult {
  public readonly executionId: string;
  public readonly status: IWorkflowExecutionResult["status"];
  public readonly outputAssets: ReadonlyArray<IAsset>;
  public readonly messages?: ReadonlyArray<string>;
  public readonly errorMessage?: string;
  public readonly provenance?: IWorkflowExecutionProvenance;
  public readonly inspection?: IWorkflowExecutionResult["inspection"];

  constructor(params: {
    executionId: string;
    status: IWorkflowExecutionResult["status"];
    outputAssets?: ReadonlyArray<IAsset>;
    messages?: ReadonlyArray<string>;
    errorMessage?: string;
    provenance?: IWorkflowExecutionProvenance;
    inspection?: IWorkflowExecutionResult["inspection"];
  }) {
    const executionId = params.executionId.trim();

    if (!executionId) {
      throw new Error("WorkflowExecutionResult.executionId cannot be empty.");
    }

    this.executionId = executionId;
    this.status = params.status;
    this.outputAssets = freezeAssets(params.outputAssets);
    this.messages = freezeMessages(params.messages);
    this.errorMessage = params.errorMessage?.trim() || undefined;
    this.provenance = freezeProvenance(params.provenance);
    this.inspection = params.inspection
      ? Object.freeze({
          summary: Object.freeze({ ...params.inspection.summary }),
          outputs: params.inspection.outputs
            ? Object.freeze(params.inspection.outputs.map((output) => Object.freeze({
                ...output,
                metadata: output.metadata ? Object.freeze({ ...output.metadata }) : undefined,
              })))
            : undefined,
          diagnostics: params.inspection.diagnostics
            ? Object.freeze({ ...params.inspection.diagnostics })
            : undefined,
        })
      : undefined;
  }

  public static from(result: IWorkflowExecutionResult): WorkflowExecutionResult {
    return new WorkflowExecutionResult({
      executionId: result.executionId,
      status: result.status,
      outputAssets: result.outputAssets,
      messages: result.messages,
      errorMessage: result.errorMessage,
      provenance: result.provenance,
      inspection: result.inspection,
    });
  }
}

export class WorkflowExecutionHandle implements IWorkflowExecutionHandle {
  public readonly executionId: string;
  public readonly input: IWorkflowExecutionInput;

  private currentProgress: IWorkflowExecutionProgress;
  private readonly completionPromise: Promise<IWorkflowExecutionResult>;
  private readonly cancelFn: (() => Promise<void>) | (() => void);
  private readonly subscribeFn?:
    | ((listener: (event: IWorkflowExecutionEvent) => void) => Promise<() => void> | (() => void))
    | undefined;

  constructor(params: {
    executionId: string;
    input: IWorkflowExecutionInput;
    initialProgress?: IWorkflowExecutionProgress;
    completionPromise: Promise<IWorkflowExecutionResult>;
    cancel?: (() => Promise<void>) | (() => void);
    subscribe?: (
      listener: (event: IWorkflowExecutionEvent) => void
    ) => Promise<() => void> | (() => void);
  }) {
    const executionId = params.executionId.trim();

    if (!executionId) {
      throw new Error("WorkflowExecutionHandle.executionId cannot be empty.");
    }

    this.executionId = executionId;
    this.input = params.input;
    this.currentProgress =
      params.initialProgress ??
      new WorkflowExecutionProgress({
        executionId,
        status: "queued",
        percent: 0,
      });

    this.completionPromise = params.completionPromise.then((result) => {
      this.currentProgress = new WorkflowExecutionProgress({
        executionId: result.executionId,
        status: result.status,
        percent: result.status === "completed" ? 100 : this.currentProgress.percent,
        message: result.errorMessage ?? result.messages?.[result.messages.length - 1],
      });

      return result;
    });

    this.cancelFn = params.cancel ?? (() => undefined);
    this.subscribeFn = params.subscribe;
  }

  public async getProgress(): Promise<IWorkflowExecutionProgress> {
    return this.currentProgress;
  }

  public async waitForCompletion(): Promise<IWorkflowExecutionResult> {
    return this.completionPromise;
  }

  public async cancel(): Promise<void> {
    await this.cancelFn();
  }

  public subscribe?(
    listener: (event: IWorkflowExecutionEvent) => void
  ): Promise<() => void> | (() => void) {
    if (!this.subscribeFn) {
      return () => undefined;
    }

    return this.subscribeFn((event) => {
      if (event.progress) {
        this.currentProgress = WorkflowExecutionProgress.from(event.progress);
      } else {
        this.currentProgress = new WorkflowExecutionProgress({
          executionId: event.executionId,
          status: event.status,
          currentNodeId: event.nodeId,
          message: event.message,
        });
      }

      listener(event);
    });
  }

  public updateProgress(progress: IWorkflowExecutionProgress): void {
    if (progress.executionId !== this.executionId) {
      throw new Error(
        `Progress execution '${progress.executionId}' does not match handle execution '${this.executionId}'.`
      );
    }

    this.currentProgress = WorkflowExecutionProgress.from(progress);
  }
}

export class WorkflowExecutor implements IWorkflowExecutor {
  private readonly executors: ReadonlyArray<IWorkflowExecutor>;

  constructor(executors: ReadonlyArray<IWorkflowExecutor> = []) {
    this.executors = Object.freeze([...executors]);
  }

  public async startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle> {
    const executor = this.resolveExecutor(input);
    return executor.startExecution(input);
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const executor = this.resolveExecutor(input);

    if (!onEvent) {
      return executor.execute(input);
    }

    const handle = await executor.startExecution(input);
    let unsubscribe: (() => void) | undefined;

    try {
      if (typeof handle.subscribe === "function") {
        const maybeUnsubscribe = await handle.subscribe((event) => {
          onEvent(WorkflowExecutionEvent.from(event));
        });

        unsubscribe =
          typeof maybeUnsubscribe === "function" ? maybeUnsubscribe : undefined;
      } else {
        const poll = async (): Promise<void> => {
          while (true) {
            const progress = await handle.getProgress();

            onEvent(
              new WorkflowExecutionEvent({
                executionId: progress.executionId,
                kind: "workflow-progress",
                status: progress.status,
                nodeId: progress.currentNodeId,
                progress,
                message: progress.message,
              })
            );

            if (
              progress.status === "completed" ||
              progress.status === "failed" ||
              progress.status === "cancelled"
            ) {
              return;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        };

        void poll();
      }

      const result = await handle.waitForCompletion();

      onEvent(
        new WorkflowExecutionEvent({
          executionId: result.executionId,
          kind:
            result.status === "completed"
              ? "workflow-completed"
              : result.status === "failed"
              ? "workflow-failed"
              : "workflow-cancelled",
          status: result.status,
          message: result.errorMessage ?? result.messages?.[result.messages.length - 1],
          payload: {
            outputAssetCount: result.outputAssets.length,
          },
        })
      );

      for (const asset of result.outputAssets) {
        onEvent(
          new WorkflowExecutionEvent({
            executionId: result.executionId,
            kind: "asset-produced",
            status: result.status,
            asset,
          })
        );
      }

      return result;
    } finally {
      unsubscribe?.();
    }
  }

  public canExecute(input: IWorkflowExecutionInput): boolean {
    return this.executors.some((executor) => executor.canExecute(input));
  }

  private resolveExecutor(input: IWorkflowExecutionInput): IWorkflowExecutor {
    const executor = this.executors.find((candidate) =>
      candidate.canExecute(input)
    );

    if (!executor) {
      const runtime =
        input.target?.runtime ??
        input.workflow.runtimeProfile?.preferredRuntime ??
        "unspecified";

      throw new Error(
        `No workflow executor is available for runtime/provider '${String(runtime)}'.`
      );
    }

    return executor;
  }
}

