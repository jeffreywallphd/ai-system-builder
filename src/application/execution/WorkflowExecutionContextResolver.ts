import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { INode } from "../../domain/nodes/interfaces/INode";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  INodeExecutionContext,
  INodeExecutionContextResolver,
} from "../ports/interfaces/INodeExecutionContextResolver";
import type { INodeOutputStore } from "../ports/interfaces/INodeOutputStore";

export class WorkflowExecutionContextResolver {
  private readonly resolver: INodeExecutionContextResolver;

  constructor(resolver: INodeExecutionContextResolver) {
    this.resolver = resolver;
  }

  public resolveNodeContext(params: {
    workflow: IWorkflow;
    node: INode;
    outputStore: INodeOutputStore;
    inputAssets?: ReadonlyArray<IAsset>;
    workflowInputs?: Readonly<Record<string, unknown>>;
    executionMetadata?: Readonly<Record<string, unknown>>;
  }): INodeExecutionContext {
    return this.resolver.resolve({
      workflow: params.workflow,
      node: params.node,
      outputStore: params.outputStore,
      inputAssets: params.inputAssets,
      workflowInputs: params.workflowInputs,
      executionMetadata: params.executionMetadata,
    });
  }
}
