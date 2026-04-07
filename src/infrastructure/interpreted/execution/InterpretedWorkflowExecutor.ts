import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../../../application/ports/interfaces/IWorkflowExecutor";
import {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
} from "../../../application/ports/WorkflowExecutor";
import { DefaultNodeExecutionContextResolver } from "./DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "./DefaultNodeOutputStore";
import { LangChainNodeExecutor } from "./LangChainNodeExecutor";

export class InterpretedWorkflowExecutor implements IWorkflowExecutor {
  public async startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle> {
    const executionId = `interpreted-${input.workflow.id}-${Date.now()}`;
    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();

    const emit = (event: IWorkflowExecutionEvent): void => {
      for (const listener of listeners) {
        listener(event);
      }
    };

    const completionPromise = this.execute(input, emit).then((result) =>
      new WorkflowExecutionResult({
        executionId,
        status: result.status,
        messages: result.messages,
        errorMessage: result.errorMessage,
        outputAssets: result.outputAssets,
      })
    );

    return new WorkflowExecutionHandle({
      executionId,
      input,
      initialProgress: new WorkflowExecutionProgress({
        executionId,
        status: "queued",
        percent: 0,
        message: "Execution queued.",
      }),
      completionPromise,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const executionId = `interpreted-${input.workflow.id}`;
    const outputStore = new DefaultNodeOutputStore();
    const resolver = new DefaultNodeExecutionContextResolver();
    const executor = new LangChainNodeExecutor();
    const nodes = input.workflow.toGraph().topologicalSort();

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-started",
        status: "running",
        progress: new WorkflowExecutionProgress({
          executionId,
          status: "running",
          percent: 0,
          message: "Starting interpreted workflow execution.",
        }),
      })
    );

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const context = resolver.resolve({
        workflow: input.workflow,
        node,
        outputStore,
        workflowInputs: input.parameters,
        inputAssets: input.inputAssets,
      });

      onEvent?.(
        new WorkflowExecutionEvent({
          executionId,
          kind: "node-started",
          status: "running",
          nodeId: node.id,
          progress: new WorkflowExecutionProgress({
            executionId,
            status: "running",
            currentNodeId: node.id,
            percent: Math.round((index / Math.max(1, nodes.length)) * 100),
            message: `Executing ${node.title}.`,
          }),
        })
      );

      const result = await executor.executeNode(context);
      if (result.status === "failed") {
        return new WorkflowExecutionResult({
          executionId,
          status: "failed",
          outputAssets: [],
          errorMessage: result.errorMessage ?? `Node ${node.title} failed.`,
          messages: result.messages,
        });
      }

      outputStore.setNodeOutput(node.id, result.outputs);

      onEvent?.(
        new WorkflowExecutionEvent({
          executionId,
          kind: "node-completed",
          status: "running",
          nodeId: node.id,
          message: result.messages?.join(" "),
          payload: {
            outputs: result.outputs,
          },
        })
      );
    }

    const snapshot = outputStore.snapshot();

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-completed",
        status: "completed",
        progress: new WorkflowExecutionProgress({
          executionId,
          status: "completed",
          percent: 100,
          message: "Workflow completed successfully.",
        }),
        payload: {
          nodeOutputs: snapshot,
        },
      })
    );

    return new WorkflowExecutionResult({
      executionId,
      status: "completed",
      outputAssets: [],
      messages: ["Interpreted workflow execution completed."],
    });
  }

  public canExecute(_input: IWorkflowExecutionInput): boolean {
    return true;
  }
}
