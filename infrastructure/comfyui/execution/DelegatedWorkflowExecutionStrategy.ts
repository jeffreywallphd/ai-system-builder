import { WorkflowExecutionResult } from "../../../application/ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "../../../application/ports/interfaces/IWorkflowExecutor";
import type {
  IWorkflowExecutionStrategy,
  IWorkflowExecutionStrategyDescriptor,
} from "../../../application/ports/interfaces/IWorkflowExecutionStrategy";

export interface IDelegatedWorkflowExecutionAdapter {
  delegate(input: IWorkflowExecutionInput): Promise<Readonly<Record<string, unknown>>>;
}

export class DelegatedWorkflowExecutionStrategy
  implements IWorkflowExecutionStrategy
{
  private readonly runtime: string;
  private readonly adapter: IDelegatedWorkflowExecutionAdapter;

  constructor(adapter: IDelegatedWorkflowExecutionAdapter, runtime = "comfyui") {
    this.runtime = runtime;
    this.adapter = adapter;
  }

  public getDescriptor(): IWorkflowExecutionStrategyDescriptor {
    return {
      id: `delegated-${this.runtime}`,
      runtime: this.runtime,
      mode: "delegated",
      supportsPartialDelegation: false,
    };
  }

  public canHandle(input: IWorkflowExecutionInput): boolean {
    const runtime =
      (typeof input.target?.runtime === "string" && input.target.runtime) ||
      input.workflow.runtimeProfile?.preferredRuntime;
    return !runtime || runtime.toLowerCase() === this.runtime.toLowerCase();
  }

  public async execute(
    input: IWorkflowExecutionInput,
    _onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const delegationPayload = await this.adapter.delegate(input);

    return new WorkflowExecutionResult({
      executionId: `${this.runtime}-${input.workflow.id}`,
      status: "completed",
      outputAssets: [],
      messages: [
        `Delegated workflow execution completed via ${this.runtime}.`,
        JSON.stringify(delegationPayload),
      ],
    });
  }
}
