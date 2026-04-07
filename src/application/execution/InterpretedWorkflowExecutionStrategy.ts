import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import {
  WorkflowExecutionEvent,
  WorkflowExecutionResult,
} from "../ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "../ports/interfaces/IWorkflowExecutor";
import type { INodeExecutionContextResolver } from "../ports/interfaces/INodeExecutionContextResolver";
import type { INodeExecutor } from "../ports/interfaces/INodeExecutor";
import type { INodeOutputStore } from "../ports/interfaces/INodeOutputStore";
import type {
  IWorkflowExecutionStrategy,
  IWorkflowExecutionStrategyDescriptor,
} from "../ports/interfaces/IWorkflowExecutionStrategy";

export interface IInterpretedWorkflowExecutionStrategyOptions {
  readonly runtime?: string;
  readonly nodeExecutor: INodeExecutor;
  readonly contextResolver: INodeExecutionContextResolver;
  readonly outputStoreFactory?: () => INodeOutputStore;
  readonly executionIdFactory?: () => string;
}

class InMemoryNodeOutputStore implements INodeOutputStore {
  private readonly outputs = new Map<string, Readonly<Record<string, unknown>>>();

  public setNodeOutput(nodeId: string, output: Readonly<Record<string, unknown>>): void {
    this.outputs.set(nodeId, Object.freeze({ ...output }));
  }

  public getNodeOutput(nodeId: string): Readonly<Record<string, unknown>> | undefined {
    return this.outputs.get(nodeId);
  }

  public hasNodeOutput(nodeId: string): boolean {
    return this.outputs.has(nodeId);
  }

  public snapshot(): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
    return Object.freeze(Object.fromEntries(this.outputs.entries()));
  }

  public clear(): void {
    this.outputs.clear();
  }
}

export class InterpretedWorkflowExecutionStrategy implements IWorkflowExecutionStrategy {
  private readonly runtime: string;
  private readonly nodeExecutor: INodeExecutor;
  private readonly contextResolver: INodeExecutionContextResolver;
  private readonly outputStoreFactory: () => INodeOutputStore;
  private readonly executionIdFactory: () => string;

  constructor(options: IInterpretedWorkflowExecutionStrategyOptions) {
    this.runtime = options.runtime ?? "langchain";
    this.nodeExecutor = options.nodeExecutor;
    this.contextResolver = options.contextResolver;
    this.outputStoreFactory =
      options.outputStoreFactory ?? (() => new InMemoryNodeOutputStore());
    this.executionIdFactory =
      options.executionIdFactory ?? (() => `exec-${Date.now().toString(36)}`);
  }

  public getDescriptor(): IWorkflowExecutionStrategyDescriptor {
    return {
      id: `interpreted-${this.runtime}`,
      runtime: this.runtime,
      mode: "interpreted",
      supportsPartialDelegation: true,
      defaultProvenance: "scaffolded",
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
    const workflow = input.workflow;
    const executionId = this.executionIdFactory();
    const outputStore = this.outputStoreFactory();

    const orderedNodes = this.resolveExecutionOrder(workflow);

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-started",
        status: "running",
        message: "Interpreted workflow execution started.",
      })
    );

    for (const node of orderedNodes) {
      const context = this.contextResolver.resolve({
        workflow,
        node,
        outputStore,
        inputAssets: input.inputAssets,
        workflowInputs: input.parameters,
        executionMetadata: { runtime: this.runtime },
      });

      onEvent?.(
        new WorkflowExecutionEvent({
          executionId,
          kind: "node-started",
          status: "running",
          nodeId: node.id,
        })
      );

      const nodeResult = await this.nodeExecutor.executeNode(context);

      if (nodeResult.status === "failed") {
        return new WorkflowExecutionResult({
          executionId,
          status: "failed",
          outputAssets: [],
          errorMessage: nodeResult.errorMessage ?? `Node '${node.id}' failed.`,
          messages: nodeResult.messages,
        });
      }

      outputStore.setNodeOutput(node.id, nodeResult.outputs);

      onEvent?.(
        new WorkflowExecutionEvent({
          executionId,
          kind: "node-completed",
          status: "running",
          nodeId: node.id,
          payload: nodeResult.outputs,
        })
      );
    }

    return new WorkflowExecutionResult({
      executionId,
      status: "completed",
      outputAssets: [],
      messages: ["Interpreted workflow execution completed."],
    });
  }

  private resolveExecutionOrder(workflow: IWorkflow) {
    const graph = workflow.toGraph();
    if (workflow.executionPolicy === "acyclic-only" && graph.hasCycles()) {
      throw new Error(`Workflow '${workflow.id}' contains cycles and cannot be interpreted.`);
    }

    return graph.topologicalSort();
  }
}

