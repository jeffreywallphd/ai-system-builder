import { WorkflowExecutionEvent, WorkflowExecutionResult } from "../../../application/ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "../../../application/ports/interfaces/IWorkflowExecutor";
import type { INodeExecutionContextResolver } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { INodeExecutor } from "../../../application/ports/interfaces/INodeExecutor";
import type { INodeOutputStore } from "../../../application/ports/interfaces/INodeOutputStore";
import type {
  IWorkflowExecutionStrategy,
  IWorkflowExecutionStrategyDescriptor,
} from "../../../application/ports/interfaces/IWorkflowExecutionStrategy";

export interface IInfrastructureInterpretedWorkflowExecutionStrategyOptions {
  readonly runtime?: string;
  readonly nodeExecutor: INodeExecutor;
  readonly contextResolver: INodeExecutionContextResolver;
  readonly outputStoreFactory: () => INodeOutputStore;
}

export class InterpretedWorkflowExecutionStrategy implements IWorkflowExecutionStrategy {
  private readonly runtime: string;
  private readonly nodeExecutor: INodeExecutor;
  private readonly contextResolver: INodeExecutionContextResolver;
  private readonly outputStoreFactory: () => INodeOutputStore;

  constructor(options: IInfrastructureInterpretedWorkflowExecutionStrategyOptions) {
    this.runtime = options.runtime ?? "langchain";
    this.nodeExecutor = options.nodeExecutor;
    this.contextResolver = options.contextResolver;
    this.outputStoreFactory = options.outputStoreFactory;
  }

  public getDescriptor(): IWorkflowExecutionStrategyDescriptor {
    return {
      id: `infra-interpreted-${this.runtime}`,
      runtime: this.runtime,
      mode: "hybrid",
      supportsPartialDelegation: true,
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
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const executionId = `${this.runtime}-${input.workflow.id}`;
    const outputStore = this.outputStoreFactory();

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-started",
        status: "running",
        message: `Interpreted execution started for runtime '${this.runtime}'.`,
      })
    );

    const nodes = input.workflow.toGraph().topologicalSort();
    for (const node of nodes) {
      const context = this.contextResolver.resolve({
        workflow: input.workflow,
        node,
        outputStore,
        inputAssets: input.inputAssets,
        workflowInputs: input.parameters,
      });
      const nodeResult = await this.nodeExecutor.executeNode(context);
      outputStore.setNodeOutput(node.id, nodeResult.outputs);
    }

    const result = new WorkflowExecutionResult({
      executionId,
      status: "completed",
      outputAssets: [],
      messages: ["Infrastructure interpreted execution completed."],
    });

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-completed",
        status: "completed",
      })
    );

    return result;
  }
}
