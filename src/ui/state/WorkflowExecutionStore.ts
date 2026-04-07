import type { IWorkflowExecutionEvent } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";

export interface IWorkflowExecutionState {
  readonly isExecuting: boolean;
  readonly lastExecutionEvent?: IWorkflowExecutionEvent;
  readonly nodeExecutionOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly outputAssets: ReadonlyArray<IAsset>;
}

export type WorkflowExecutionStoreListener = (
  state: IWorkflowExecutionState
) => void;

export interface IWorkflowExecutionStoreOptions {
  readonly initialState?: Partial<IWorkflowExecutionState>;
}

export const defaultWorkflowExecutionState: IWorkflowExecutionState = Object.freeze({
  isExecuting: false,
  lastExecutionEvent: undefined,
  nodeExecutionOutputs: Object.freeze({}),
  outputAssets: Object.freeze([]),
});

export class WorkflowExecutionStore {
  private readonly listeners = new Set<WorkflowExecutionStoreListener>();
  private state: IWorkflowExecutionState;

  constructor(options: IWorkflowExecutionStoreOptions = {}) {
    this.state = freezeExecutionState({
      ...defaultWorkflowExecutionState,
      ...toExecutionState(options.initialState),
    });
  }

  public getState(): IWorkflowExecutionState {
    return this.state;
  }

  public subscribe(listener: WorkflowExecutionStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public beginExecution(): void {
    this.setState({
      isExecuting: true,
      lastExecutionEvent: undefined,
      nodeExecutionOutputs: Object.freeze({}),
      outputAssets: Object.freeze([]),
    });
  }

  public recordEvent(event: IWorkflowExecutionEvent): void {
    const payloadOutputs = extractNodeOutputs(event);

    this.setState({
      lastExecutionEvent: event,
      nodeExecutionOutputs: payloadOutputs ?? this.state.nodeExecutionOutputs,
      outputAssets: event.asset
        ? Object.freeze([...this.state.outputAssets, event.asset])
        : this.state.outputAssets,
    });
  }

  public completeExecution(outputAssets?: ReadonlyArray<IAsset>): void {
    this.setState({
      isExecuting: false,
      outputAssets: Object.freeze([...(outputAssets ?? this.state.outputAssets)]),
    });
  }

  public failExecution(): void {
    this.setState({
      isExecuting: false,
    });
  }

  public clearSession(): void {
    this.setState(defaultWorkflowExecutionState);
  }

  private setState(patch: Partial<IWorkflowExecutionState>): void {
    this.state = freezeExecutionState({
      ...this.state,
      ...toExecutionState(patch),
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function toExecutionState(
  state: Partial<IWorkflowExecutionState> | undefined
): Partial<IWorkflowExecutionState> {
  if (!state) {
    return {};
  }

  const nextState: Partial<IWorkflowExecutionState> = {};

  if ("isExecuting" in state) {
    nextState.isExecuting = state.isExecuting;
  }

  if ("lastExecutionEvent" in state) {
    nextState.lastExecutionEvent = state.lastExecutionEvent;
  }

  if ("nodeExecutionOutputs" in state) {
    nextState.nodeExecutionOutputs = state.nodeExecutionOutputs;
  }

  if ("outputAssets" in state) {
    nextState.outputAssets = state.outputAssets;
  }

  return nextState;
}

function extractNodeOutputs(
  event: IWorkflowExecutionEvent
): Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined {
  if (!event.payload || !("nodeOutputs" in event.payload)) {
    return undefined;
  }

  return event.payload.nodeOutputs as Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
}

function freezeExecutionState(state: IWorkflowExecutionState): IWorkflowExecutionState {
  return Object.freeze({
    ...state,
    nodeExecutionOutputs: Object.freeze({ ...(state.nodeExecutionOutputs ?? {}) }),
    outputAssets: Object.freeze([...(state.outputAssets ?? [])]),
  });
}
