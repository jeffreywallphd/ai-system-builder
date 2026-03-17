import { WorkflowExecutionEvent, WorkflowExecutionResult } from "../../../application/ports/WorkflowExecutor";
import type { IWorkflowExecutionEvent, IWorkflowExecutionInput, IWorkflowExecutionResult } from "../../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionStrategy, IWorkflowExecutionStrategyDescriptor } from "../../../application/ports/interfaces/IWorkflowExecutionStrategy";
import type { IPythonRuntimeClient, IPythonRuntimeExecuteWorkflowRequest } from "../../../application/ports/interfaces/IPythonRuntimeClient";

function nodePropertiesToObject(properties: ReadonlyArray<{ id: string; value: unknown }>): Readonly<Record<string, unknown>> {
  return Object.freeze(Object.fromEntries(properties.map((property) => [property.id, property.value])));
}

export class PythonDelegatedWorkflowExecutionStrategy implements IWorkflowExecutionStrategy {
  private readonly client: IPythonRuntimeClient;

  constructor(client: IPythonRuntimeClient) {
    this.client = client;
  }

  public getDescriptor(): IWorkflowExecutionStrategyDescriptor {
    return {
      id: "infra-delegated-python",
      runtime: "python",
      mode: "delegated",
      supportsPartialDelegation: false,
    };
  }

  public canHandle(input: IWorkflowExecutionInput): boolean {
    const runtime =
      (typeof input.target?.runtime === "string" && input.target.runtime) ||
      input.workflow.runtimeProfile?.preferredRuntime;

    return !runtime || runtime.toLowerCase() === "python";
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const executionId = `python-${input.workflow.id}`;

    onEvent?.(new WorkflowExecutionEvent({ executionId, kind: "workflow-started", status: "running", message: "Delegating workflow to python runtime." }));

    const request: IPythonRuntimeExecuteWorkflowRequest = {
      executionId,
      workflowId: input.workflow.id,
      workflowInputs: input.parameters,
      nodes: input.workflow.nodes.map((node) => ({
        id: node.id,
        nodeType: node.definition.type,
        properties: nodePropertiesToObject(node.properties),
      })),
      connections: input.workflow.connections.map((connection) => ({
        sourceNodeId: connection.source.nodeId,
        sourcePortId: connection.source.portId,
        targetNodeId: connection.target.nodeId,
        targetPortId: connection.target.portId,
      })),
    };

    const response = await this.client.executeWorkflow(request);

    const result = new WorkflowExecutionResult({
      executionId: response.executionId,
      status: response.status,
      outputAssets: [],
      messages: response.messages,
      errorMessage: response.errorMessage,
    });

    onEvent?.(new WorkflowExecutionEvent({ executionId: result.executionId, kind: result.status === "completed" ? "workflow-completed" : "workflow-failed", status: result.status, message: result.errorMessage }));

    return result;
  }
}
