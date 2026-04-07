import { aggregateWorkflowProvenance, ensureNodeExecutionProvenance } from "@application/execution/ExecutionTruth";
import { WorkflowExecutionEvent, WorkflowExecutionResult } from "@application/ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "@application/ports/interfaces/IWorkflowExecutor";
import type { INodeExecutionContextResolver } from "@application/ports/interfaces/INodeExecutionContextResolver";
import type { INodeExecutor } from "@application/ports/interfaces/INodeExecutor";
import type { INodeOutputStore } from "@application/ports/interfaces/INodeOutputStore";
import type {
  IWorkflowExecutionStrategy,
  IWorkflowExecutionStrategyDescriptor,
} from "@application/ports/interfaces/IWorkflowExecutionStrategy";

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
      id: `infra-scaffold-${this.runtime}`,
      runtime: this.runtime,
      mode: "hybrid",
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
    const executionId = `${this.runtime}-${input.workflow.id}`;
    const outputStore = this.outputStoreFactory();
    const nodeProvenance: Record<string, NonNullable<IWorkflowExecutionResult["provenance"]>["nodeProvenance"][string]> = {};

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-started",
        status: "running",
        message: `Scaffold execution started for runtime '${this.runtime}'.`,
        provenance: {
          classification: "scaffolded",
          runtime: this.runtime,
          strategyId: this.getDescriptor().id,
          detail: "Running scaffold interpreter fallback.",
        },
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
        executionMetadata: input.executionMetadata,
      });
      const nodeResult = await this.nodeExecutor.executeNode(context);
      nodeProvenance[node.id] = ensureNodeExecutionProvenance(node, nodeResult.provenance, { delegatedRuntimeAvailable: true });
      outputStore.setNodeOutput(node.id, nodeResult.outputs);

      onEvent?.(new WorkflowExecutionEvent({
        executionId,
        kind: nodeResult.status === "failed" ? "node-failed" : "node-completed",
        status: nodeResult.status === "failed" ? "failed" : "running",
        nodeId: node.id,
        message: nodeResult.errorMessage ?? nodeResult.messages?.join(" "),
        payload: nodeResult.status === "failed"
          ? Object.freeze({
              nodeId: node.id,
              outputs: nodeResult.outputs,
            })
          : undefined,
        nodeProvenance: nodeProvenance[node.id],
      }));

      if (nodeResult.status === "failed") {
        return new WorkflowExecutionResult({
          executionId,
          status: "failed",
          outputAssets: [],
          messages: nodeResult.messages,
          errorMessage: nodeResult.errorMessage ?? `Node '${node.id}' failed during scaffold execution.`,
          provenance: aggregateWorkflowProvenance({
            strategyId: this.getDescriptor().id,
            runtime: this.runtime,
            detail: "Scaffold execution stopped after a node failure.",
            nodeProvenance: Object.freeze({ ...nodeProvenance }),
            fallback: { kind: "scaffold-interpreter", isActive: true, reason: "The interpreted scaffold fallback handled workflow execution." },
          }),
        });
      }
    }

    const result = new WorkflowExecutionResult({
      executionId,
      status: "completed",
      outputAssets: [],
      messages: ["Scaffold workflow execution completed."],
      provenance: aggregateWorkflowProvenance({
        strategyId: this.getDescriptor().id,
        runtime: this.runtime,
        detail: "Workflow executed by the scaffold interpreter fallback.",
        selectionReason: "Scaffold interpreter fallback was selected for this workflow.",
        nodeProvenance: Object.freeze({ ...nodeProvenance }),
        fallback: { kind: "scaffold-interpreter", isActive: true, reason: "The interpreted scaffold fallback handled workflow execution." },
      }),
    });

    onEvent?.(
      new WorkflowExecutionEvent({
        executionId,
        kind: "workflow-completed",
        status: "completed",
        provenance: result.provenance,
      })
    );

    return result;
  }
}

