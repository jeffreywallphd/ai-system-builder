import type { INodeExecutionProvenance } from "./IWorkflowExecutor";
import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { INodeExecutionContext } from "./INodeExecutionContextResolver";

export interface INodeExecutionResult {
  readonly nodeId: string;
  readonly status: "completed" | "failed" | "skipped";
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly messages?: ReadonlyArray<string>;
  readonly errorMessage?: string;
  readonly provenance?: INodeExecutionProvenance;
}

export interface INodeExecutor {
  canExecuteNode(node: INode, runtime?: string): boolean;
  executeNode(context: INodeExecutionContext): Promise<INodeExecutionResult>;
}
